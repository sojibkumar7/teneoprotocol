const config = require('../config');
const Helpers = require('./helpers');

class TelegramCheck {
  static extractUsernameFromUrl(url) {
    try {
      if (!url) return null;
      
      // If it's already a username with @, remove the @
      if (url.startsWith('@')) {
        return url.substring(1);
      }
      
      // Remove any query parameters and get the last part of URL
      const cleanUrl = url.split('?')[0];
      
      // Handle different URL formats
      if (cleanUrl.includes('t.me/')) {
        const parts = cleanUrl.split('t.me/');
        return parts[1].replace('/', '');
      } else if (cleanUrl.includes('telegram.me/')) {
        const parts = cleanUrl.split('telegram.me/');
        return parts[1].replace('/', '');
      }
      
      return cleanUrl;
    } catch (error) {
      console.error('Error extracting username from URL:', error);
      return null;
    }
  }

  static async checkMembership(ctx, chatId, userId) {
    try {
      const member = await ctx.telegram.getChatMember(chatId, userId);
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
      console.error(`Error checking membership for chat ${chatId}:`, error.message);
      return false;
    }
  }

  static async verifyAllMemberships(ctx, userId) {
    const results = {
      channel: false,
      group: false,
      allJoined: false,
      missing: []
    };

    try {
      // Check channel membership
      const channelUsername = Helpers.extractTelegramUsername(config.TASK_URLS.TELEGRAM_CHANNEL);
      if (channelUsername) {
        results.channel = await this.checkMembership(ctx, `@${channelUsername}`, userId);
        if (!results.channel) {
          results.missing.push(`📢 Telegram Channel: ${config.TASK_URLS.TELEGRAM_CHANNEL}`);
        }
      } else {
        console.error('Invalid channel URL:', config.TASK_URLS.TELEGRAM_CHANNEL);
      }

      // Check group membership  
      const groupUsername = Helpers.extractTelegramUsername(config.TASK_URLS.TELEGRAM_GROUP);
      if (groupUsername) {
        results.group = await this.checkMembership(ctx, `@${groupUsername}`, userId);
        if (!results.group) {
          results.missing.push(`👥 Telegram Group: ${config.TASK_URLS.TELEGRAM_GROUP}`);
        }
      } else {
        console.error('Invalid group URL:', config.TASK_URLS.TELEGRAM_GROUP);
      }

      results.allJoined = results.channel && results.group;
      return results;

    } catch (error) {
      console.error('Membership verification error:', error);
      results.missing.push('❌ Error checking membership. Please try again.');
      return results;
    }
  }

  static getMembershipMessage(membershipResults) {
    if (membershipResults.allJoined) {
      return '✅ You have joined all required channels and groups!';
    } else {
      return `❌ *Please join these required channels:*\n\n${membershipResults.missing.join('\n')}\n\n🔁 After joining, press *Continue* again to verify.`;
    }
  }
}

module.exports = TelegramCheck;