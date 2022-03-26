
 
import web3utils from 'web3-utils'

import  fs from 'fs' 
import path from 'path'

import FileUtils from './file-utils.js'
import { cav } from '../../caver.js'

let tokenContractJSON = FileUtils.readJsonFileSync('/src/contracts/SigmoidToken.json');
let paymentContractJSON = FileUtils.readJsonFileSync('/src/contracts/UniqueBatchedPayments.json');
let deployedContractInfo = FileUtils.readJsonFileSync('/src/config/DeployedContractInfo.json');

  

export default class ContractHelper {

  
  //for minting only 
  //DEPRECATED
   static getTokenContract( poolConfig  )
  {
   
    var contract =  new cav.contract(tokenContractJSON.abi,this.getTokenContractAddress(poolConfig));
    return contract;
  } 

  static getMintingTokenContract( poolConfig )
  {
   
    var contract =  new cav.contract(tokenContractJSON.abi,this.getMintingTokenContractAddress(poolConfig));
    return contract;
  } 

  static getPaymentsTokenContract( poolConfig )
  {
   
    var contract =  new cav.contract(tokenContractJSON.abi, this.getPaymentsTokenContractAddress(poolConfig));
    return contract;
  } 


  static getBatchedPaymentsContract( poolConfig )
  {
   
    var contract =  new cav.contract(paymentContractJSON,this.getBatchedPaymentContractAddress(poolConfig));
    return contract;
  } 
 
  //DEPRECATED
   static getTokenContractAddress(poolConfig)
      {

        let pool_env = poolConfig.poolEnv 

        let networkName = poolConfig.mintingConfig.networkName

        var address= deployedContractInfo.networks[networkName].contracts.sigmoidtoken.blockchain_address;
      

        return cav.utils.toChecksumAddress(address)
      //  console.error('no pool env set', pool_env)
      } 


    static getMintingTokenContractAddress(poolConfig)
    {

      let pool_env = poolConfig.poolEnv 

      let networkName = poolConfig.mintingConfig.networkName

      var address= deployedContractInfo.networks[networkName].contracts.sigmoidtoken.blockchain_address;
    

      return cav.utils.toChecksumAddress(address)
    //  console.error('no pool env set', pool_env)
    } 


   static getPaymentsTokenContractAddress(poolConfig)
   {

     let pool_env = poolConfig.poolEnv 

     let networkName = poolConfig.paymentsConfig.networkName

     var address= deployedContractInfo.networks[networkName].contracts.sigmoidtoken.blockchain_address;
   

     return cav.utils.toChecksumAddress(address)
     //console.error('no pool env set', pool_env)
   } 
 
    

      static getBatchedPaymentContractAddress(poolConfig)
      {
      let pool_env = poolConfig.poolEnv 

      let networkName = poolConfig.paymentsConfig.networkName

       //console.log('networkname', networkName)

        var address= deployedContractInfo.networks[networkName].contracts.batchedpayments.blockchain_address;
        

        return cav.utils.toChecksumAddress(address)
        //console.error('no pool env set', pool_env)
      } 
      

}
