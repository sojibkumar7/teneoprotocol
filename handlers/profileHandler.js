const { Markup } = require('telegraf');
const User = require('../models/User');
const { isValidBSCAddress } = require('../utils/bnb');
const { formatWithUSD } = require('../utils/helpers');

async function showProfile(ctx) {
  try {
    // Follow me @Airdropmanaging
    const user = await User.findById(ctx.user._id);
    if (!user) return ctx.reply('❌ User profile not found');

    await ctx.replyWithHTML(
      `<b>Your Profile:</b>\n\n` +
      `🆔 Telegram: <code>${user.telegramUsername || 'Not set'}</code>\n` +
      `🐦 Twitter: <code>${user.twitterUsername || 'Not set'}</code>\n` +
      `💼 Wallet: <code>${user.walletAddress || 'Not set'}</code>\n\n` +
      `💰 Balance: <b>${formatWithUSD(user.balance)}</b>\n` +
      `👥 Referrals: <b>${user.referrals.length}</b>`,
      Markup.inlineKeyboard([
        Markup.button.callback('✏️ Edit Profile', 'edit_profile')
      ])
    );
  } catch (error) {
    console.error('Profile display error:', error);
    await ctx.reply('❌ Error displaying profile. Please try again.');
  }
}

async function handleProfileUpdate(ctx) {
  try {
    // Get the full Mongoose document for updates
    const user = await User.findById(ctx.user._id);
    if (!user) return ctx.reply('❌ User not found');

    if (ctx.session.profileStep === 'telegram') {
      const username = ctx.message.text.trim();
      if (!username.startsWith('@')) {
        return await ctx.reply('⚠️ Please enter a valid Telegram username starting with @');
      }
      
      user.telegramUsername = username;
      await user.save();
      
      ctx.session.profileStep = 'twitter';
      return await ctx.reply('Please enter your Twitter username (without @):');
    }

    if (ctx.session.profileStep === 'twitter') {
      const twitterUsername = ctx.message.text.trim();
      if (twitterUsername.includes('@')) {
        return await ctx.reply('⚠️ Please enter your Twitter username without @');
      }
      
      user.twitterUsername = twitterUsername;
      await user.save();
      
      ctx.session.profileStep = 'wallet';
      return await ctx.reply('Please enter your BNB wallet address (starts with 0x):');
    }

    if (ctx.session.profileStep === 'wallet') {
      const walletAddress = ctx.message.text.trim();
      
      if (!isValidBSCAddress(walletAddress)) {
        return await ctx.reply(
          '⚠️ Please enter a valid BNB Testnet wallet address:\n' +
          '• Should start with 0x\n' +
          '• Should be exactly 42 characters long\n' +
          '• Should be a valid Ethereum-style address\n' +
          '• Example: 0x742d35Cc6634C893292Ce8bB6239C002Ad8e6b59'
        );
      }
      
      user.walletAddress = walletAddress;
      user.profileCompleted = true;
      
      // Handle referral logic
      if (ctx.session.referralId) {
        const referrer = await User.findOne({ telegramId: ctx.session.referralId });
        if (referrer) {
          referrer.referrals.push({
            userId: user.telegramId,
            username: user.username,
            completed: false,
            claimed: false,
            referredAt: new Date()
          });
          
          await referrer.save();
          await ctx.reply(`🎉 You were referred by ${referrer.username || referrer.firstName}!`);
        }
      }
      
      await user.save();
      delete ctx.session.profileStep;
      delete ctx.session.referralId;
      
      await ctx.reply('✅ Profile data saved successfully!');
      return await require('./startHandler').showMainMenu(ctx);
    }
  } catch (error) {
    console.error('Profile update error:', error);
    await ctx.reply('❌ Error saving profile data. Please try again.');
  }
}

module.exports = { showProfile, handleProfileUpdate };
