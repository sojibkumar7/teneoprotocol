const { Markup } = require('telegraf');
const User = require('../models/User');
const { formatWithUSD } = require('../utils/helpers');

async function showReferral(ctx) {
  try {
    const referralLink = `https://t.me/${ctx.botInfo.username}?start=${ctx.user.telegramId}`;
    const completedCount = ctx.user.referrals.filter(ref => ref.completed).length;
    const pendingCount = ctx.user.referrals.filter(ref => !ref.completed).length;
    
    await ctx.replyWithHTML(
      `<b>📢 Referral Program</b>\n\n` +
      `Invite friends and earn <b>${formatWithUSD(parseInt(process.env.REFERRAL_BONUS))}</b> for each!\n\n` +
      `<b>Requirements:</b>\n` +
      `- - Referred friend must join the required Telegram channel\n` +
      `- Bonus credited only once per referral\n\n` +
      `<b>Your referral link:</b>\n<code>${referralLink}</code>\n\n` +
      `<b>Total referrals:</b> ${ctx.user.referrals.length}\n` +
      `<b>Pending completion:</b> ${pendingCount}\n` +
      `<b>Completed referrals:</b> ${completedCount}`,
      Markup.inlineKeyboard([
        Markup.button.callback('🔄 Refresh', 'refresh_referrals')
      ])
    );
  } catch (error) {
    console.error('Referral display error:', error);
    await ctx.reply('❌ Error loading referral information. Please try again.');
  }
}

async function checkReferralCompletion(ctx) {
  try {
    const user = await User.findById(ctx.user._id);
    if (!user) return;

    const referrals = await User.find({
      referredBy: user.telegramId
    });

    let updated = false;

    for (const referral of referrals) {

      if (
        referral.completedTasks &&
        referral.completedTasks.length > 0
      ) {

        const refIndex = user.referrals.findIndex(
          r => r.userId === referral.telegramId
        );

        if (refIndex !== -1 && !user.referrals[refIndex].completed) {

          user.referrals[refIndex].completed = true;
          user.referrals[refIndex].claimed = true;
          user.referrals[refIndex].completedAt = new Date();

          user.balance += parseInt(process.env.REFERRAL_BONUS || 0);

          updated = true;

          await ctx.telegram.sendMessage(
            user.telegramId,
            `🎉 Referral Bonus Received!\n\n+${formatWithUSD(parseInt(process.env.REFERRAL_BONUS || 0))} has been added to your balance.`
          );
        }
      }
    }

    if (updated) {
      await user.save();
    }

  } catch (error) {
    console.error("Referral completion check error:", error);
  }
}   

// Get updated user data
    const user = await User.findById(ctx.user._id);
    const referralLink = `https://t.me/${ctx.botInfo.username}?start=${user.telegramId}`;
    const completedCount = user.referrals.filter(ref => ref.completed).length;
    const pendingCount = user.referrals.filter(ref => !ref.completed).length;
    
    // Create the new message content
    const newMessageText = 
      `<b>📢 Referral Program</b>\n\n` +
      `Invite friends and earn <b>${formatWithUSD(parseInt(process.env.REFERRAL_BONUS))}</b> for each!\n\n` +
      `<b>Requirements:</b>\n` +
      `- Referred friend must complete at least 1 task\n` +
      `- Bonus credited only once per referral\n\n` +
      `<b>Your referral link:</b>\n<code>${referralLink}</code>\n\n` +
      `<b>Total referrals:</b> ${user.referrals.length}\n` +
      `<b>Pending completion:</b> ${pendingCount}\n` +
      `<b>Completed referrals:</b> ${completedCount}`;
    
    // Get current message text to compare
    const currentMessageText = ctx.update.callback_query.message.text;
    
    // Only edit if the content has actually changed
    if (currentMessageText !== newMessageText) {
      await ctx.editMessageText(newMessageText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'refresh_referrals' }]
          ]
        }
      });
    } else {
      // If content is the same, just answer the callback without editing
      await ctx.answerCbQuery('✅ Already up to date!');
    }
    
    return true;
  } catch (error) {
    if (error.response && error.response.description.includes('message is not modified')) {
      // This is expected - content hasn't changed
      await ctx.answerCbQuery('✅ Already up to date!');
      return true;
    }
    console.error('Referral refresh error:', error);
    throw error;
  }
}

module.exports = { showReferral, checkReferralCompletion, refreshReferral };
