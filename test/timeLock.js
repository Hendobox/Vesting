const { expectRevert, time } = require('@openzeppelin/test-helpers');
const TimeLockFactory = artifacts.require('TimeLockFactory');
const ERC20 = artifacts.require('ERC20');

contract('TimeLockFactory', (accounts) => {
    let timelock;
    const [beneficiary1, beneficiary2, beneficiary3] = [accounts[1], accounts[2], accounts[3]];
  
    before(async () => {
        timelock = await TimeLockFactory.deployed();
        erc20 = await ERC20.deployed();
        await erc20.transfer(timelock.address, 10000);
    });

    it('Should have transferred balance of 10000 tokens', async () => {
        const balance = await erc20.balanceOf(timelock.address);
        assert.equal(balance, 10000);
    });

    it('Should have equal number of beneficiaries and percentages', async () => {
        const length = await timelock.beneficiaries;
        for(i = 0; i < length.length; i+1) {
            const beneficiary = await timelock.beneficiaries.call('i');
            const percent = await timelock.scheduleList.call('i');
            assert.equal(beneficiary.length, percent.length);
        }
    });

    it('Should sum all percentages to 100', async () => {
        const percent = await timelock.scheduleList;
        for(i = 0; i < percent.length; i+1) {
            const totalPercentages = 0 + percent[i];
            assert.equal(totalPercentages, 100);
        }
    });

    it('Should record the correct percentage each beneficiary', async () => {
        const percent1 = await timelock.percentageOf(beneficiary1);
        const percent2 = await timelock.percentageOf(beneficiary2);
        const percent3 = await timelock.percentageOf(beneficiary3);
        assert.equal(percent1, 20); 
        assert.equal(percent2, 30);
        assert.equal(percent3, 50);
    });

    it('Should NOT distribute payments before time', async () => {
        await expectRevert(
            timelock.distributePayment(erc20.address),
            'Realease time not reached'
        );
    });

    it('Should NOT withdraw before distribution is made', async () => {
        await expectRevert(
            timelock.withdrawPayment(erc20.address, {from: beneficiary1}),
            'No balance to withdraw'
        );
    });

    it('Should distribute appropriate allocations on every payout', async () => {
        await time.increase(120000);
        await timelock.distributePayment(erc20.address);
        let balance1 = await timelock.balances(beneficiary1, erc20.address);
        let balance2 = await timelock.balances(beneficiary2, erc20.address);
        let balance3 = await timelock.balances(beneficiary3, erc20.address);
        assert.equal(balance1.toNumber(), 500);
        assert.equal(balance2.toNumber(), 750);
        assert.equal(balance3.toNumber(), 1250);

        await time.increase(240000);
        await timelock.distributePayment(erc20.address);
        let balance11 = await timelock.balances(beneficiary1, erc20.address);
        let balance22 = await timelock.balances(beneficiary2, erc20.address);
        let balance33 = await timelock.balances(beneficiary3, erc20.address);
        assert.equal(balance11.toNumber(), 1000);
        assert.equal(balance22.toNumber(), 1500);
        assert.equal(balance33.toNumber(), 2500);
        
        await erc20.transfer(timelock.address, 2000);

        await timelock.withdrawPayment(erc20.address, {from: beneficiary1});
        await timelock.withdrawPayment(erc20.address, {from: beneficiary2});
        await timelock.withdrawPayment(erc20.address, {from: beneficiary3});

        await time.increase(360000);
        await timelock.distributePayment(erc20.address);
        let balance111 = await timelock.balances(beneficiary1, erc20.address);
        let balance222 = await timelock.balances(beneficiary2, erc20.address);
        let balance333 = await timelock.balances(beneficiary3, erc20.address);
        assert.equal(balance111.toNumber(), 700);
        assert.equal(balance222.toNumber(), 1050);
        assert.equal(balance333.toNumber(), 1750);
        
        await timelock.withdrawPayment(erc20.address, {from: beneficiary2});
        await timelock.withdrawPayment(erc20.address, {from: beneficiary3});

        await time.increase(480000);
        await timelock.distributePayment(erc20.address);
        let balance1111 = await timelock.balances(beneficiary1, erc20.address);
        let balance2222 = await timelock.balances(beneficiary2, erc20.address);
        let balance3333 = await timelock.balances(beneficiary3, erc20.address);
        assert.equal(balance1111.toNumber(), 1400);
        assert.equal(balance2222.toNumber(), 1050);
        assert.equal(balance3333.toNumber(), 1750);

        
    });

    it('Should NOT make withdrawal for non-beneficiaries', async () => {
        await expectRevert(
            timelock.withdrawPayment(erc20.address),
            'No balance to withdraw'
        );
    });

    it('Should not allow non-owner to create new vesting', async () => {
        await expectRevert(
            timelock.newVesting([beneficiary2, beneficiary3], [50, 50], [240000, 360000, 480000], {from: beneficiary1}),
            'only owner can do this'
        );
    });

});