import "@typechain/hardhat";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "hardhat-dependency-compiler";
import "@openzeppelin/hardhat-upgrades";

import { HardhatUserConfig, task } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.5.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.6.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.4.18",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  dependencyCompiler: {
    paths: [
      "@uniswap/v2-periphery/contracts/UniswapV2Router02.sol",
      "@uniswap/v2-core/contracts/UniswapV2Factory.sol",
      "@uniswap/v2-core/contracts/UniswapV2Pair.sol",
    ],
  },
};

export default config;
