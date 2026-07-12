// bnb.js
const { ethers } = require('ethers');
require('dotenv').config();

// BNB Network Configuration
const BNB_RPC_URL = process.env.BNB_RPC_URL || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545';
const BNB_CHAIN_ID = parseInt(process.env.BNB_CHAIN_ID) || 97;
const BNB_EXPLORER = process.env.BNB_EXPLORER || 'https://testnet.bscscan.com';
const BNB_WALLET_PRIVATE_KEY = process.env.BNB_WALLET_PRIVATE_KEY;
const BNB_DEPOSIT_ADDRESS = process.env.BNB_DEPOSIT_ADDRESS;
const CURRENCY_NAME = process.env.CURRENCY_NAME || 'doginme';

// Ultra-low gas settings (~$0.01 per transaction)
const MIN_GAS_BALANCE = ethers.parseEther('0.0000025'); // ~$0.01 worth of ETH
const GAS_LIMIT = 65000; // Optimized gas limit for ERC20 transfers
const MAX_PRIORITY_FEE = ethers.parseUnits('2', 'gwei'); // Very low priority fee
const MAX_FEE_PER_GAS = ethers.parseUnits('5', 'gwei'); // Very low max fee

// ERC20 Token ABI (simplified)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)'
];

// Initialize provider and wallet
const provider = new ethers.JsonRpcProvider(BNB_RPC_URL, BNB_CHAIN_ID);
let wallet;
let tokenContract;

// Add a lock mechanism to prevent concurrent transactions
let transactionLock = false;

// Retry function with exponential backoff
async function retryOperation(operation, maxRetries = 3, delay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      console.log(`⚠️ Retry ${i + 1}/${maxRetries} after error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
}

// Get optimized gas settings for ultra-low fees
async function getOptimizedGasSettings() {
  try {
    const feeData = await provider.getFeeData();
    
    // Use very conservative gas prices for minimal fees
    return {
      maxPriorityFeePerGas: MAX_PRIORITY_FEE,
      maxFeePerGas: MAX_FEE_PER_GAS,
      gasLimit: GAS_LIMIT
    };
  } catch (error) {
    console.log('Using fallback gas settings');
    return {
      maxPriorityFeePerGas: MAX_PRIORITY_FEE,
      maxFeePerGas: MAX_FEE_PER_GAS,
      gasLimit: GAS_LIMIT
    };
  }
}

// Calculate estimated gas cost in USD
function calculateGasCostInUSD(gasUsed, gasPrice, ethPrice = 4183) {
  const gasCostETH = (BigInt(gasUsed) * BigInt(gasPrice)) / BigInt(1e18);
  const gasCostUSD = (Number(ethers.formatEther(gasCostETH)) * ethPrice);
  return gasCostUSD.toFixed(4);
}

// Initialize wallet and token contract
async function initBNBWallet() {
  try {
    if (!BNB_WALLET_PRIVATE_KEY) {
      throw new Error('BNB_WALLET_PRIVATE_KEY not set in .env');
    }
    
    if (!BNB_DEPOSIT_ADDRESS) {
      throw new Error('BNB_DEPOSIT_ADDRESS not set in .env');
    }
    
    wallet = new ethers.Wallet(BNB_WALLET_PRIVATE_KEY, provider);
    tokenContract = new ethers.Contract(BNB_DEPOSIT_ADDRESS, ERC20_ABI, wallet);
    
    console.log('✅ BNB Wallet Initialized:', {
      address: wallet.address,
      tokenContract: BNB_DEPOSIT_ADDRESS
    });
    
    return { wallet, tokenContract };
  } catch (e) {
    console.error('❌ BNB wallet init failed:', e.message);
    throw e;
  }
}

// Quick balance check without decimals call
async function quickBalanceCheck() {
  try {
    // Ensure wallet is initialized
    if (!wallet || !tokenContract) {
      await initBNBWallet();
    }
    
    const tokenBalance = await tokenContract.balanceOf(wallet.address);
    return ethers.formatUnits(tokenBalance, 18); // Force 18 decimals
  } catch (error) {
    console.error('Quick balance check failed:', error);
    return '0';
  }
}

// Get ETH and token balances with retry
async function getBNBBalances() {
  try {
    await initBNBWallet();
    
    const operation = async () => {
      const [ethBalance, tokenBalance] = await Promise.all([
        provider.getBalance(wallet.address),
        tokenContract.balanceOf(wallet.address)
      ]);
      
      // Use 18 decimals directly
      const decimals = 18;
      
      const ethBalanceUSD = (parseFloat(ethers.formatEther(ethBalance)) * 4183);
      const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, decimals);
      
      return {
        status: 'active',
        address: wallet.address,
        ethBalance: ethers.formatEther(ethBalance),
        ethBalanceUSD: ethBalanceUSD.toFixed(2),
        tokenBalance: tokenBalanceFormatted,
        decimals: decimals,
        timestamp: new Date().toISOString()
      };
    };
    
    return await retryOperation(operation);
  } catch (e) {
    console.error('❌ BNB balance check failed after retries:', e.message);
    
    // Fallback: try to get at least ETH balance
    try {
      const ethBalance = await provider.getBalance(wallet.address);
      const ethBalanceUSD = (parseFloat(ethers.formatEther(ethBalance)) * 4183);
      
      return {
        status: 'partial',
        address: wallet.address,
        ethBalance: ethers.formatEther(ethBalance),
        ethBalanceUSD: ethBalanceUSD.toFixed(2),
        tokenBalance: '0',
        decimals: 18,
        error: `Token balance unavailable: ${e.message}`,
        timestamp: new Date().toISOString()
      };
    } catch (fallbackError) {
      return {
        status: 'error',
        error: e.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Send tokens with ultra-low gas optimization
async function sendBNBTokens(toAddress, amount) {
  // Wait if another transaction is in progress
  while (transactionLock) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  try {
    transactionLock = true;
    
    if (!toAddress || !amount) {
      throw new Error('Recipient address and amount are required');
    }
    
    await initBNBWallet();
    
    // Check if recipient address is valid
    if (!ethers.isAddress(toAddress)) {
      throw new Error('Invalid recipient address');
    }
    
    const operation = async () => {
      // Use 18 decimals directly
      const decimals = 18;
      const amountInWei = ethers.parseUnits(amount.toString(), decimals);
      
      // Check token balance
      const tokenBalance = await tokenContract.balanceOf(wallet.address);
      const formattedBalance = ethers.formatUnits(tokenBalance, decimals);
      
      console.log(`Wallet balance: ${formattedBalance}, Required: ${amount}`);
      
      if (tokenBalance < amountInWei) {
        throw new Error(`Insufficient token balance (needs ${amount}, has ${formattedBalance})`);
      }
      
      // Check ETH balance for gas (ultra-low requirement)
      const ethBalance = await provider.getBalance(wallet.address);
      const formattedEthBalance = ethers.formatEther(ethBalance);
      console.log(`ETH balance: ${formattedEthBalance} ETH`);
      
      if (ethBalance < MIN_GAS_BALANCE) {
        const ethNeeded = ethers.formatEther(MIN_GAS_BALANCE - ethBalance);
        const usdNeeded = (parseFloat(ethNeeded) * 4183).toFixed(4);
        throw new Error(`Insufficient ETH for gas fees. Need ~${ethNeeded} ETH ($${usdNeeded}) more`);
      }
      
      // Get optimized gas settings
      const gasSettings = await getOptimizedGasSettings();
      
      // Estimate gas cost with fallback
      let gasEstimate;
      try {
        gasEstimate = await tokenContract.transfer.estimateGas(toAddress, amountInWei);
      } catch (gasError) {
        console.warn('Gas estimation failed, using default:', gasError.message);
        gasEstimate = BigInt(GAS_LIMIT);
      }
      
      // Calculate estimated cost
      const estimatedGasCost = gasEstimate * gasSettings.maxFeePerGas;
      const estimatedCostUSD = calculateGasCostInUSD(gasEstimate, gasSettings.maxFeePerGas);
      
      console.log('💰 Estimated gas cost:', `$${estimatedCostUSD}`);
      
      if (ethBalance < estimatedGasCost) {
        throw new Error(`Insufficient ETH for gas. Need ${ethers.formatEther(estimatedGasCost)} ETH ($${estimatedCostUSD})`);
      }
      
      // Send tokens with optimized gas settings
      console.log('Sending tokens...');
      const tx = await tokenContract.transfer(toAddress, amountInWei, gasSettings);
      
      console.log('Transaction sent, waiting for confirmation...');
      const receipt = await tx.wait();
      
      // Calculate actual gas cost
      const actualGasCostUSD = calculateGasCostInUSD(receipt.gasUsed, receipt.gasPrice);
      
      console.log('Transaction confirmed:', receipt.hash);
      
      return {
        success: true,
        txHash: receipt.hash,
        recipient: toAddress,
        amount: amount.toString(),
        gasUsed: ethers.formatEther(receipt.gasUsed * receipt.gasPrice),
        gasUsedUSD: actualGasCostUSD,
        explorerUrl: `${BNB_EXPLORER}/tx/${receipt.hash}`
      };
    };
    
    return await retryOperation(operation, 2, 2000);
  } catch (err) {
    console.error('❌ Token send failed after retries:', err);
    
    // Provide user-friendly error messages
    let userFriendlyError = err.message;
    
    if (err.message.includes('CALL_EXCEPTION') || err.message.includes('revert')) {
      userFriendlyError = 'Token contract interaction failed. Please contact support.';
    } else if (err.message.includes('Insufficient')) {
      userFriendlyError = 'Insufficient funds. Please try again later.';
    } else if (err.message.includes('gas')) {
      userFriendlyError = 'Transaction failed due to gas issues. Please contact support.';
    }
    
    return {
      success: false,
      error: userFriendlyError
    };
  } finally {
    transactionLock = false;
  }
}

// Validate BNB address
function isValidBSCAddress(address) {
  return ethers.isAddress(address);
}

// Health check function
async function checkBNBHealth() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    const gasSettings = await getOptimizedGasSettings();
    
    return {
      healthy: true,
      blockNumber,
      chainId: network.chainId,
      name: network.name,
      gasPrice: ethers.formatUnits(gasSettings.maxFeePerGas, 'gwei') + ' gwei',
      estimatedCost: `~$${calculateGasCostInUSD(GAS_LIMIT, gasSettings.maxFeePerGas)} per tx`
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

// Debug function to check token details
async function debugTokenInfo() {
  try {
    await initBNBWallet();
    
    console.log('=== Token Debug Information ===');
    console.log('Token Address:', BNB_DEPOSIT_ADDRESS);
    console.log('Wallet Address:', wallet.address);
    
    // Try to get token info with fallbacks
    let name = 'Unknown', symbol = 'Unknown', totalSupply = 'Unknown', balance = 'Unknown';
    
    try {
      name = await tokenContract.name();
      console.log('Token Name:', name);
    } catch (e) {
      console.log('Token Name: Unavailable');
    }
    
    try {
      symbol = await tokenContract.symbol();
      console.log('Token Symbol:', symbol);
    } catch (e) {
      console.log('Token Symbol: Unavailable');
    }
    
    try {
      const supply = await tokenContract.totalSupply();
      totalSupply = ethers.formatUnits(supply, 18);
      console.log('Total Supply:', totalSupply);
    } catch (e) {
      console.log('Total Supply: Unavailable');
    }
    
    try {
      const bal = await tokenContract.balanceOf(wallet.address);
      balance = ethers.formatUnits(bal, 18);
      console.log('Wallet Balance:', balance);
    } catch (e) {
      console.log('Wallet Balance: Unavailable');
    }
    
    // Check ETH balance
    const ethBalance = await provider.getBalance(wallet.address);
    console.log('ETH Balance:', ethers.formatEther(ethBalance));
    
    return {
      success: true,
      name,
      symbol,
      balance,
      totalSupply,
      ethBalance: ethers.formatEther(ethBalance)
    };
    
  } catch (error) {
    console.error('Token debug failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  initBNBWallet,
  getBNBBalances,
  sendBNBTokens,
  isValidBSCAddress,
  BNB_EXPLORER,
  checkBNBHealth,
  debugTokenInfo,
  quickBalanceCheck,
  retryOperation,
  calculateGasCostInUSD
};
