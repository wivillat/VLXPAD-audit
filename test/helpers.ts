import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import hre from "hardhat";

const ZeroAddress: string = ethers.constants.AddressZero;
const maxInt: BigNumber = ethers.constants.MaxUint256;

const ether = (n: string) => {
  return ethers.utils.parseEther(n);
};

const tokens = (n: string) => {
  return ethers.utils.parseUnits(n, 18);
};

const formatADS = (n: BigNumber) => {
  return ethers.utils.formatUnits(n.toString(), 18);
};

const formatEther = (n: BigNumber) => {
  return ethers.utils.formatUnits(n.toString(), 18);
};

const increaseTime = async (n: number) => {
  await hre.network.provider.request({
    method: "evm_increaseTime",
    params: [n],
  });

  await hre.network.provider.request({
    method: "evm_mine",
    params: [],
  });
};

const timeLimit = (n: number) => {
  return Math.floor(Date.now() / 1000 + n);
};

const now = () => {
  return Math.floor(Date.now() / 1000);
};

class Snapshot {
  snapshotId: number;

  constructor() {
    this.snapshotId = 0;
  }

  async revert() {
    await hre.network.provider.send("evm_revert", [this.snapshotId]);
    return this.snapshot();
  }

  async snapshot() {
    this.snapshotId = await hre.network.provider.send("evm_snapshot", []);
  }
}

const clamp = (value: number, min: number, max: number) => {
  return Math.floor(Math.min(Math.max(value, min), max));
};

export {
  clamp,
  now,
  maxInt,
  ZeroAddress,
  ether,
  tokens,
  increaseTime,
  timeLimit,
  Snapshot,
  formatADS,
  formatEther,
};
