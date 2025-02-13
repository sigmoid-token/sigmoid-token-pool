


 
import TokenDataHelper from "./token-data-helper.js";
import Web3ApiHelper from "./web3-api-helper.js";
import LoggingHelper from "./logging-helper.js";

 
import web3utils from 'web3-utils'
import { cav } from '../../caver.js'

export default class PeerHelper {


    //this is in seconds -- for now 
    static getTimeNowSeconds()
    {
      return Math.round((new Date()).getTime() / 1000);
    } 

    static getTimeNowUnix()
    {
      return Math.round((new Date()).getTime() );
    } 

    static getPoolMinimumShareDifficulty(poolConfig)
    {
      return  poolConfig.miningConfig.minimumShareDifficulty;
    } 


    static getPoolMinimumShareTarget( poolConfig ) //compute me
    { 
       let diff =   PeerHelper.getPoolMinimumShareDifficulty( poolConfig )
      
      return this.getTargetFromDifficulty(diff);
    } 
 
 
    static getTargetFromDifficulty(difficulty)
    {
    

      var max_target = cav.utils.toBN( 2 ).pow( cav.utils.toBN( 234 ) );
 
      var current_target = max_target / cav.utils.toBN( difficulty);
 
      return current_target ;
    } 
 
 


   static   getPoolData(poolConfig)
    {
      return {
        tokenFee: this.poolConfig.poolTokenFee,
        mintingAddress: this.accountConfig.minting.address,
        paymentAddress: this.accountConfig.payment.address
      }
    } 

    

    static getPoolEthAddress(poolConfig)
    {

      return poolConfig.mintingConfig.publicAddress

      
    } 

    
 

    static async getMinerBalancePayments(minerAddress,  mongoInterface)
    { 
      var payments = await mongoInterface.findAllSortedWithLimit('balance_payments',{minerEthAddress: minerAddress.toString().toLowerCase()}, {block:-1} , 250)
   
      return payments

    }




    //this finds or creates miner data 
  static async getMinerData(minerEthAddress, mongoInterface)
  {
    if(minerEthAddress)
    {
      var minerData  = await mongoInterface.findOne("minerData", {minerEthAddress: minerEthAddress.toString().toLowerCase() } );

      if(minerData  == null)
      {
        let newMinerData =  PeerHelper.getDefaultMinerData(minerEthAddress)
        
        await mongoInterface.insertOne("minerData", newMinerData)

        return await mongoInterface.findOne("minerData", {minerEthAddress: minerEthAddress.toString().toLowerCase() } );

      }

       return minerData 
    }

     return null;

  } 

 

  static getDefaultMinerData(minerEthAddress){

    if(minerEthAddress == null) minerEthAddress = "0x0"; //this should not happen

    return {
      minerEthAddress: minerEthAddress.toString().toLowerCase(),
       shareCredits: 0,
      tokenBalance: 0, //what the pool owes currenc..deprecated
      alltimeTokenBalance: 0,  //total amt pool owes (total amt mined)
      tokensAwarded:0, //total amt added to balance payments !
   //   varDiff: 1, //default
       validSubmittedSolutionsCount: 0,
      lastSubmittedSolutionTime: 0
    }
  } 

  static getDefaultSharesData(minerEthAddress){

    if(minerEthAddress == null) minerEthAddress = "0x0"; //this should not happen

    return {
      minerEthAddress: minerEthAddress.toString().toLowerCase(),
       shareCredits: 0,
      // varDiff: 1, //default
       validSubmittedSolutionsCount: 0,
       hashrate: 0
    }
  } 


  static async getTotalMinerShares(mongoInterface)
  {
    var allMinerData  = await PeerHelper.getMinerList(mongoInterface)
 


    var totalShares = 0;

    for(let minerData of  allMinerData)
    { 
     // var sharesData = await PeerHelper.getSharesData(minerData.minerEthAddress, mongoInterface)
       
      //var minerAddress = minerData.minerEthAddress;
      var minerShares = minerData.shareCredits;

      totalShares += minerShares;
    }

    console.log('got miner total shares', totalShares)
    return totalShares;

  } 



  static async getTotalMinerHashrate(mongoInterface)
  {
    var allMinerData  = await PeerHelper.getMinerList(mongoInterface)
  
 
    var totalHashrate = 0;

    for(let minerData of  allMinerData)
    { 
       //var sharesData = await PeerHelper.getSharesData(minerData.minerEthAddress, mongoInterface)
         
       var hashrate = parseInt(minerData.hashRate)

      if(hashrate)
      {
        totalHashrate += hashrate;
      }

    }

    console.log('got miner total hashrate', totalHashrate)
    return totalHashrate;

  } 


  static async awardShareCredits( minerEthAddress, shareCredits , mongoInterface)
  {


    let minerData = await PeerHelper.getMinerData(minerEthAddress, mongoInterface)


    

    await mongoInterface.updateOneCustom('minerData',{_id: minerData._id }, {$inc:{
      shareCredits: parseInt(shareCredits),
      validSubmittedSolutionsCount: 1 
    }, $set:{lastSubmittedSolutionTime:PeerHelper.getTimeNowSeconds() }} )

   
  } 

  


  static async getMinerShares(minerEthAddress, mongoInterface)
  {
    if(minerEthAddress)
    {
      minerEthAddress = minerEthAddress.toString().toLowerCase()


      var sharesData = await mongoInterface.findAllSortedWithLimit("miner_shares", {minerEthAddress: minerEthAddress}, {block:-1},250 );

      if(sharesData)
      {
         return  sharesData  ;
      }

      
    }

    return [] 

  }

 
  static async awardTokensBalanceForShares( minerEthAddress, difficulty , poolConfig, mongoInterface)
  {

   var minerData = await PeerHelper.getMinerData(minerEthAddress,mongoInterface)
 
   //var sharesData = await PeerHelper.getSharesData(minerEthAddress,mongoInterface)
 
    //shareCredits is an int 
    let tokenRewardAmt = await PeerHelper.getTokenRewardForShareOfDifficulty(difficulty,poolConfig, mongoInterface)

     

    let tokensAwarded = Math.floor(  tokenRewardAmt ) 

    if(isNaN(tokensAwarded) || tokensAwarded == 0){
      LoggingHelper.appendLog( [ 'WARN: no tokens awardable for ',minerEthAddress, tokensAwarded ], LoggingHelper.TYPECODES.WARN , mongoInterface)

 
      return false 
    }
    
    await mongoInterface.updateOneCustom('minerData', {_id: minerData._id}, 
            {$inc:{alltimeTokenBalance: tokensAwarded}}   )

      LoggingHelper.appendLog( [ 'miner data - award tokenbalance ', minerEthAddress,tokensAwarded ], LoggingHelper.TYPECODES.SHARES, mongoInterface)

    //await PeerHelper.saveSharesData(minerEthAddress,sharesData, mongoInterface)
  } 



  /*
    This is multiplied by share credits (difficulty) to determine the number of tokens to reward
    This depends on:

    The difficulty of 0xbtc (avg 0xbtc per share)

    Less fees:      
    The estimated % of 0xbtc wasted on gas fees 

    
  */
  static async getTokenRewardForShareOfDifficulty(shareDiff, poolConfig, mongoInterface){

    let totalDifficulty = await TokenDataHelper.getMiningDifficultyTarget(mongoInterface)
    if(isNaN(totalDifficulty)){
      console.log('ERROR: totalDifficulty missing')
      return 0
    }


    let rewardFactor = PeerHelper.getRewardFactor(shareDiff,totalDifficulty)

    let totalBlockReward = await TokenDataHelper.getMiningReward(mongoInterface)
    if(isNaN(totalBlockReward)){
      console.log('ERROR: totalBlockReward missing')
      return 0
    }

    let poolFeesMetrics = await PeerHelper.getPoolFeesMetrics(poolConfig, mongoInterface)
    let poolFeesFactor = poolFeesMetrics.overallFeeFactor
    
    //limit pool fees factor above 0.5 
    if(poolFeesFactor < 0.5){
     poolFeesFactor = 0.5
    } 
   
    if(poolFeesFactor > 1.0){
     poolFeesFactor = 1
    } 

    let netBlockReward = totalBlockReward * PeerHelper.constrainToPercent(1.0 - poolFeesFactor) 

    let netReward = rewardFactor * netBlockReward; 

    //console.log('reward factor', rewardFactor , shareDiff, totalDifficulty)

    
    return netReward
  }


  //make sure this is correct, probabilistically 
  static getRewardFactor(shareDiff, totalDiff){
    return Math.min( ( shareDiff / totalDiff  ) , 1.0 ) 
  }
 

  static async getPoolFeesMetrics(poolConfig, mongoInterface){

    let poolBaseFee = PeerHelper.constrainToPercent(poolConfig.mintingConfig.poolTokenFee / 100.0)

    let miningRewardRaw = await TokenDataHelper.getMiningReward(mongoInterface)
    let token_Eth_Price_Ratio = await TokenDataHelper.getMineableTokenToEthPriceRatio(mongoInterface)

    if(!token_Eth_Price_Ratio || token_Eth_Price_Ratio == 0){
      console.log('WARN: Missing price oracle for pool fees factor')
      return 1
    }

    const TOKEN_DECIMALS = 8 

    let miningRewardFormatted = Web3ApiHelper.rawAmountToFormatted(miningRewardRaw, TOKEN_DECIMALS) 

    let miningRewardInEth = (miningRewardFormatted * PeerHelper.constrainToPercent(token_Eth_Price_Ratio))

   

    let avgGasPriceGWei = await Web3ApiHelper.getGasPriceWeiForTxType('solution', poolConfig,  mongoInterface)
   
    
    const gasRequiredForMint = 94626 //93230
    const ethPerGWei = 0.000000001

    let ethRequiredForMint = gasRequiredForMint * avgGasPriceGWei * ethPerGWei

    
    let gasFee = PeerHelper.constrainToPercent(ethRequiredForMint / miningRewardInEth);

    return  {
      poolBaseFee: poolBaseFee ,
      gasCostFee:gasFee,

      token_Eth_Price_Ratio: token_Eth_Price_Ratio, 

      miningRewardRaw: miningRewardRaw,
      miningRewardFormatted: miningRewardFormatted,  
      miningRewardInEth: miningRewardInEth, 

      avgGasPriceGWei: avgGasPriceGWei,
      miningRewardInEth: miningRewardInEth,
      ethRequiredForMint: ethRequiredForMint,
      overallFeeFactor: PeerHelper.constrainToPercent(poolBaseFee + gasFee) 

    }


  }



  static constrainToPercent(x){
    return Math.min(Math.max(x,0), 1)
  }
   

  //this needs to use config adn oracles 
  static async getMaxGweiPriceUntilMiningSuspension(poolConfig, mongoInterface){
    return 100
  }
  
    
   static  async getMinerList( mongoInterface )
    {
        
        let minerData = await mongoInterface.findAll( "minerData", {} )
        
        return minerData;
 
    } 



  static async cleanOldData(mongoInterface, poolConfig){

    let timeNow = PeerHelper.getTimeNowSeconds()

    let ONE_DAY = 24*60*60*1


    await mongoInterface.deleteMany('miner_shares', { time: {$lt: timeNow - ONE_DAY } } )

  }
 
    
     
   /*
   This does avg hashrate calcs  

   */

   //FIXME
  static async calculateMinerHashrateData(mongoInterface, poolConfig)
  {
 

      var minerList =  await PeerHelper.getMinerList( mongoInterface )

      //  console.log( 'calculateMinerHashrateData', minerList )

      for(let minerData of minerList) //reward each miner
      {
        var minerAddress = minerData.minerEthAddress

        let lastSubmittedSolutionTime = parseInt(minerData.lastSubmittedSolutionTime)

        let unixTimeNow = PeerHelper.getTimeNowSeconds()

        const TEN_MINUTES = 60*10;  
        
        let noRecentSolution = (isNaN(lastSubmittedSolutionTime) || (unixTimeNow - lastSubmittedSolutionTime > TEN_MINUTES)   )

        if(noRecentSolution == true){
          await mongoInterface.updateOne('minerData', {_id: minerData._id},  {avgHashrate: 0}    )
          continue
        }

        var sharesArray = await PeerHelper.getMinerShares(minerAddress, mongoInterface)

        if(sharesArray == null || sharesArray.length<5){
          await mongoInterface.updateOne('minerData', {_id: minerData._id},  {avgHashrate: 0}    )
          continue
        }

        let avgHashrate = 0

        for(let i=0;i<5;i++){
          let share = sharesArray[i]
          avgHashrate+=share.hashrateEstimate
        }


        avgHashrate = avgHashrate/5;

        await mongoInterface.updateOne('minerData', {_id: minerData._id},  {avgHashrate: avgHashrate}    )

        
      }
    } 


     
  static async getShareCreditsFromDifficulty(difficulty,poolConfig)
  {
    var minShareDifficulty = PeerHelper.getPoolMinimumShareDifficulty(poolConfig)  ;
    //var miningDifficulty = parseFloat( await this.tokenInterface.getPoolDifficulty() ) ;

    const SOLUTION_FINDING_BONUS = 0

      //if submitted a solution
     // return 10000;

     var amount = Math.floor( difficulty   ) ;
      

      amount += SOLUTION_FINDING_BONUS;
      return amount;
  } 




  
  static async saveMinerDataToRedisMongo(minerEthAddress, minerData, mongoInterface)
  {

    if(minerEthAddress == null) return;

    minerEthAddress = minerEthAddress.toString().toLowerCase()

    //await this.redisInterface.storeRedisHashData("miner_data_downcase", minerEthAddress , JSON.stringify(minerData))

    let result = await mongoInterface.upsertOne("minerData",{minerEthAddress: minerEthAddress},minerData)

    return result 
  } 

  




   static getEstimatedShareHashrate(difficulty, timeToFindSeconds )
   {
     if(timeToFindSeconds!= null && timeToFindSeconds>0)
     {

        var hashrate = cav.utils.toBN(difficulty).mul( cav.utils.toBN(2).pow(  cav.utils.toBN(22) )).div( cav.utils.toBN( timeToFindSeconds ) )

        return hashrate.toNumber(); //hashes per second

      }else{
        return 0;
      }
   } 

  static async estimateMinerHashrate(minerAddress, mongoInterface)
   {
  //   console.log('estimateMinerHashrate')
      try {

        var submitted_shares = await PeerHelper.getSharesData(minerAddress, mongoInterface)


        //var submitted_shares =  await mongoInterface.findAll('miner_shares', {minerEthAddress: minerAddress.toString().toLowercase()})// await this.redisInterface.getParsedElementsOfListInRedis(('miner_submitted_share:'+minerAddress.toString().toLowerCase()), 20);

        if(submitted_shares == null || submitted_shares.length < 1)
        {
          console.log('no submitted shares')
          return 0;
        }

        //need to use BN for totalDiff

        var totalDiff = cav.utils.toBN(0);
        var CUTOFF_MINUTES = 90;
        var cutoff = PeerHelper.getTimeNowSeconds() - (CUTOFF_MINUTES * 60);

        // the most recent share seems to be at the front of the list
        var recentShareCount = 0;
        while (recentShareCount < submitted_shares.length && submitted_shares[recentShareCount].time > cutoff) {

          var diffDelta = submitted_shares[recentShareCount].difficulty;

          if(isNaN(diffDelta)) diffDelta = 0;

          totalDiff = totalDiff.add(  cav.utils.toBN(diffDelta) );
        //  totalDiff += submitted_shares[recentShareCount].difficulty;
          recentShareCount++;
        }

        if ( recentShareCount == 0 )
        {
        //  console.log('no recent submitted shares')
          return 0;
        }


        console.log('miner recent share count: ', recentShareCount )
        var seconds = submitted_shares[0].time - submitted_shares[recentShareCount - 1].time;
        if (seconds == 0)
        {
          console.log('shares have no time between')
          return 0;
        }

        console.log('hashrate calc ', totalDiff, seconds )
        var hashrate = PeerHelper.getEstimatedShareHashrate( totalDiff, seconds );
        return hashrate.toString();

      } catch(err)
      {
        console.log('Error in peer-interface::estimateMinerHashrate: ',err);
        return 0;
      }
  } 


  //timeToFind
  static async getAverageSolutionTime(minerAddress, mongoInterface)
  {
    if(minerAddress == null) return null;

    var submitted_shares =  await this.redisInterface.getRecentElementsOfListInRedis(('miner_submitted_share:'+minerAddress.toString().toLowerCase()), 3)

    var sharesCount = 0;

    if(submitted_shares == null || submitted_shares.length < 1)
    {
      return null;
    }


    var summedFindingTime  = 0;

    for (var i=0;i<submitted_shares.length;i++)
    {
      var share = submitted_shares[i];

      var findingTime = parseInt(share.timeToFind);

      if(!isNaN(findingTime) && findingTime> 0 && findingTime != null)
      {
          summedFindingTime += findingTime;
            sharesCount++;
       }
    }

    if(sharesCount <= 0)
    {
      return null;
    }


    var timeToFind = Math.floor(summedFindingTime / sharesCount);
    return timeToFind;
  } 


 
   static async getBalanceTransferConfirmed(paymentId, mongoInterface)
   {
      //check balance payment

      var balanceTransferJSON = await this.redisInterface.findHashInRedis('balance_transfer',paymentId);
      var balanceTransfer = JSON.parse(balanceTransferJSON)


      if(balanceTransferJSON == null || balanceTransfer.txHash == null)
      {
        return false;
      }else{

        //dont need to check receipt because we wait many blocks between broadcasts - enough time for the monitor to populate this data correctly
        return balanceTransfer.confirmed;

      }


   } 




   static  async saveSubmittedSolutionTransactionData(tx_hash,transactionData, mongoInterface)
     {
        await this.redisInterface.storeRedisHashData('submitted_solution_tx',tx_hash,JSON.stringify(transactionData) )
        await this.redisInterface.pushToRedisList('submitted_solutions_list',JSON.stringify(transactionData) )

     } 


     static async loadStoredSubmittedSolutionTransaction(tx_hash, mongoInterface )
   {
      var txDataJSON = await this.redisInterface.findHashInRedis('submitted_solution_tx',tx_hash);
      var txData = JSON.parse(txDataJSON)
      return txData
   } 

 
/*
   static async incrementPoolMetrics(metricDeltas, mongoInterface){

    console.log('increment metrics', metricDeltas)

    //await mongoInterface.update   $inc ... 
   }
*/


}
