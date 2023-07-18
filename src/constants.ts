// same address on all networks: https://github.com/mds1/multicall#multicall2-contract-addresses
export const multicall2Address = "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696";

// same address on all networks: https://www.multicall3.com/deployments
export const multicall3Address = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const multicall3ZkSyncAddress = "0xF9cda624FBC7e059355ce98a31693d299FACd963";

export const multicallAddresses = new Set([
  multicall2Address.toLowerCase(),
  multicall3Address.toLowerCase(),
  multicall3ZkSyncAddress.toLowerCase(),
]);

export const multicall3ChainAddress: { [chainId: number]: string } = {
  280: multicall3ZkSyncAddress, // zkSync Ero Goerli
  324: multicall3ZkSyncAddress, // zkSync Era
};

export const multicall3DeploymentBlockNumbers: { [chainId: number]: number } = {
  1: 14353601, // Mainnet
  3: 12063863, // Ropsten
  4: 10299530, // Rinkeby
  5: 6507670, // Goerli
  42: 30285908, // Kovan
  11155111: 751532, // Sepolia
  10: 4286263, // Optimism
  420: 49461, // Optimism Goerli
  42161: 7654707, // Arbitrum
  42170: 1746963, // Arbitrum Nova
  421613: 88114, // Arbitrum Goerli
  421611: 88114, // Arbitrum Rinkeby
  137: 25770160, // Polygon
  80001: 25444704, // Polygon Mumbai
  100: 21022491, // Gnosis
  43114: 11907934, // Avalanche
  43113: 7096959, // Avalanche Fuji
  250: 33001987, // Fantom Opera
  4002: 8328688, // Fantom Testnet
  56: 15921452, // BSC
  97: 17422483, // BSC Tesnet
  1284: 609002, // Moonbeam
  1285: 1597904, // Moonriver
  1287: 1850686, // Moonbase Alpha Testnet
  1666600000: 24185753, // Harmony
  25: 1963112, // Cronos
  122: 16146628, // Fuse
  14: 3002461, // Flare
  280: 5885690, // zkSync Ero Goerli
  324: 3908235, // zkSync Era
};

export const multicall2DeploymentBlockNumbers: { [chainId: number]: number } = {
  1: 12336033, // Mainnet
  3: 9894101, // Ropsten
  4: 8283206, // Rinkeby
  5: 4489716, // Goerli
  42: 24025820, // Kovan
};
