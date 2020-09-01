const TimeLockFactory = artifacts.require("TimeLockFactory");
const ERC20 = artifacts.require("ERC20");

module.exports = function(deployer, _network, accounts) {
  deployer.deploy(TimeLockFactory, [accounts[1], accounts[2], accounts[3]], [20, 30, 50], [120000, 240000, 360000, 480000]);
  deployer.deploy(ERC20, 'TokenName', 'TKN', 1000000);
};