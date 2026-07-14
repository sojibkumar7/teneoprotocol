require('dotenv').config();

// Helper function to convert Telegram usernames to URLs for tasks
function getTaskUrls() {
  const convertToUrl = (username) => {
    if (!username) return "";

    if (username.startsWith('@')) {
      return `https://t.me/${username.substring(1)}`;
    }

    if (username.startsWith('http')) {
      return username;
    }

    return `https://t.me/${username}`;
  };

  return {
    TELEGRAM_CHANNEL_1: process.env.TELEGRAM_CHANNEL_1,
    TELEGRAM_CHANNEL_2: process.env.TELEGRAM_CHANNEL_2,

    TELEGRAM_CHANNEL_URL: convertToUrl(process.env.TELEGRAM_CHANNEL_1),
    TELEGRAM_GROUP_URL: convertToUrl(process.env.TELEGRAM_CHANNEL_2),

    TWITTER_PROFILE: process.env.TWITTER_PROFILE,
    RETWEET_LINK: process.env.RETWEET_LINK,
    TWEET_POST: process.env.TWEET_POST
  };
}

module.exports = {
  BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  MONGODB_URL: process.env.MONGO_URI,
  ADMIN_ID: parseInt(process.env.ADMIN_IDS),

  TASK_URLS: getTaskUrls(),

  BOT_CONFIG: {
    MCJ_TOKEN_SYMBOL: process.env.CURRENCY_NAME || 'TENEO',
    TASK_REWARD: 50,
    REFERRAL_REWARD: 25,
    MIN_REFERRALS_FOR_LEADERBOARD: 1
  }
};

// Validate required environment variables
const required = [
  'TELEGRAM_BOT_TOKEN',
  'MONGO_URI',
  'TELEGRAM_CHANNEL_1',
  'TELEGRAM_CHANNEL_2'
];

required.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
});

console.log('✅ Environment variables loaded successfully');
