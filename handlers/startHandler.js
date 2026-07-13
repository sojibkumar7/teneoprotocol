const { Markup } = require('telegraf');
const Task = require('../models/Task');
const User = require('../models/User');
const TelegramCheck = require('../utils/telegramCheck');
const { formatWithUSD } = require('../utils/helpers');
const { generateCaptcha } = require('../utils/captcha'); // Follow me @Airdropmanaging

async function handleStart(ctx) {
  try {
    // Follow me @Airdropmanaging
    const startPayload = ctx.message.text.split(' ')[1];
    
    if (startPayload && startPayload !== ctx.user.telegramId.toString()) {
      ctx.session.referralId = startPayload;
      await ctx.reply(`🎉 You were referred by user ${startPayload}!`);
    }

    // Follow me @Airdropmanaging
    if (!ctx.session.captchaSolved) {
      await showCaptcha(ctx);
      return;
    }

    if (!ctx.user.profileCompleted) {
    ctx.user.profileCompleted = true;
    await ctx.user.save();
}

    // Follow me @Airdropmanaging
    await showMainMenu(ctx);
  } catch (error) {
    console.error('Start command error:', error);
    await ctx.reply('❌ Error processing start command. Please try again.');
  }
}

// Follow me @Airdropmanaging
async function showCaptcha(ctx) {
  const captcha = generateCaptcha();
  ctx.session.captchaAnswer = captcha.answer;
  ctx.session.captchaSolved = false;
  
  await ctx.replyWithHTML(
    '🔐 <b>CAPTCHA Verification</b>\n\n' +
    `Please solve this simple math problem:\n` +
    `<code>${captcha.question} = ?</code>\n\n` +
    'Enter your answer:'
  );
}

async function showVerificationTasks(ctx) {
  await ctx.replyWithHTML(
    `<b>🔐 Verification Required</b>\n\n` +
    `Please verify that you've joined our channels and group:\n\n` +
    `📢 <a href="https://t.me/Airdropmanaging">Airdrop Managing</a>\n` +
    `💬 <a href="https://t.me/airdropunknow">Airdrop Unknow</a>\n` +
    `🐥 <a href="https://x.com/Airdropmanaging">Follow Our Twitter</a>\n\n` +
    `Click the verify buttons after joining:`,
    Markup.inlineKeyboard([
      [
        Markup.button.url('📢 Join Channel', 'https://t.me/Airdropmanaging'),
        Markup.button.callback('✅ Verify', 'verify_channel_1')
      ],
      [
        Markup.button.url('💬 Join Group', 'https://t.me/Airdropmanaging'),
        Markup.button.callback('✅ Verify', 'verify_channel_2')
      ],
      [
        Markup.button.url('🐥 Follow Twitter', 'https://x.com/Airdropmanaging'),
        Markup.button.callback('✅ Verify', 'verify_group')
      ],
      [
        Markup.button.callback('➡️ Continue', 'continue_after_verify')
      ]
    ])
  );
}

async function showTasks(ctx, tasks = null) {
  const activeTasks = tasks || await Task.find({ 
    active: true,
    _id: { $nin: ctx.user.completedTasks }
  }).sort({ createdAt: -1 });
  
  if (activeTasks.length === 0) {
    return ctx.reply('No active tasks available at the moment.');
  }
  
  const buttons = activeTasks.map(task => [
    Markup.button.url(task.title, task.link),
    Markup.button.callback(`Verify (${formatWithUSD(task.reward)})`, `verify_task_${task._id}`)
  ]);
  
  await ctx.replyWithHTML(
    '<b>📋 Available Tasks</b>\n\n' +
    'Complete tasks and earn tokens!\n' +
    '1. Click the task link\n' +
    '2. Complete the requirements\n' +
    '3. Click "Verify" to submit proof',
    Markup.inlineKeyboard(buttons)
  );
}

async function handleTaskVerification(ctx) {
  const taskId = ctx.match[1];
  const task = await Task.findById(taskId);
  
  if (!task) return ctx.answerCbQuery('❌ Task not found!');
  if (ctx.user.completedTasks.includes(taskId)) return ctx.answerCbQuery('❌ You already completed this task!');
  
  ctx.session.currentTask = taskId;
  
  switch(task.type) {
    case 'telegram': await verifyTelegramTask(ctx, task); break;
    case 'twitter': await verifyTwitterTask(ctx, task); break;
    default: await verifyGenericTask(ctx, task);
  }
  
  return ctx.answerCbQuery();
}

async function verifyTelegramTask(ctx, task) {
  try {
    const chatUsername = task.link.split('/').pop();
    ctx.session.verificationData = { chatId: `@${chatUsername}`, taskId: task._id };
    
    const chatMember = await ctx.telegram.getChatMember(`@${chatUsername}`, ctx.from.id);
    
    if (['member', 'administrator', 'creator'].includes(chatMember.status)) {
      await completeTask(ctx);
    } else {
      await ctx.replyWithHTML(
        `<b>Telegram Task Verification</b>\n\n` +
        `Please join:\n` +
        `<a href="${task.link}">${task.title}</a>\n\n` +
        `Then click the button below to verify:`,
        Markup.inlineKeyboard([
          Markup.button.callback('✅ Verify Membership', 'verify_telegram_membership')
        ])
      );
    }
  } catch (error) {
    console.error('Telegram verification error:', error);
    await ctx.reply('❌ Error verifying membership. Please make sure the bot is admin in the target chat and try again.');
  }
}

async function verifyTwitterTask(ctx, task) {
  ctx.session.verificationStep = 'twitter_username';
  await ctx.replyWithHTML(
    `<b>Twitter Task Verification</b>\n\n` +
    `Please enter your Twitter username (without @) that you used to:\n` +
    `<a href="${task.link}">${task.title}</a>`
  );
}

async function verifyGenericTask(ctx, task) {
  ctx.session.verificationStep = 'screenshot';
  await ctx.replyWithHTML(
    `<b>Task Verification</b>\n\n` +
    `Please submit a screenshot as proof of completing:\n` +
    `<a href="${task.link}">${task.title}</a>`
  );
}

async function showMainMenu(ctx) {
  const menuText = '🎮 <b>Main Menu</b>\n\nChoose an option:';
  
  const menuButtons = Markup.keyboard([
    ['💰 Balance', '👤 Profile'],
    ['📢 Referral', '💸 Withdraw'],
    ['📋 Tasks', '📜 History']
  ]).resize();
  
  await ctx.replyWithHTML(menuText, menuButtons);
}

async function completeTask(ctx) {
  const task = await Task.findById(ctx.session.currentTask);
  if (!task) return;
  
  // Follow me @Airdropmanaging
  const user = await User.findById(ctx.user._id);
  if (!user) return;
  
  if (user.completedTasks.includes(task._id)) {
    await ctx.reply('❌ You have already completed this task!');
    return;
  }

  user.balance += task.reward;
  user.completedTasks.push(task._id);
  await user.save();
  
  await ctx.replyWithHTML(
    `✅ Task completed successfully!\n` +
    `<b>+${formatWithUSD(task.reward)}</b> added to your balance.\n\n` +
    `Current balance: <b>${formatWithUSD(user.balance)}</b>`
  );
  
  delete ctx.session.currentTask;
  delete ctx.session.verificationStep;
  delete ctx.session.verificationData;
}

async function collectUserData(ctx) {
  ctx.session.profileStep = 'telegram';
  await ctx.replyWithHTML(
    '📝 <b>Profile Setup</b>\n\n' +
    'Please enter your Telegram username (with @):\n' +
    '<i>Example: @username</i>'
  );
}

module.exports = {
  handleStart,
  showCaptcha, // Follow me @Airdropmanaging
  showVerificationTasks,
  showTasks,
  handleTaskVerification,
  completeTask,
  verifyTelegramTask,
  verifyTwitterTask,
  verifyGenericTask,
  collectUserData,
  showMainMenu

};



