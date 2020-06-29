'use strict';

let serverlessHelper = null;

const ERROR_NOT_AVAILABLE_PHONE_NUMBER = 'ERROR_NOT_AVAILABLE_PHONE_NUMBER';
const CALL_STACK_LIMIT = 3;

exports.handler = async (context, event, callback) => {
  try {
    const twilioClient = require('twilio')(context.ACCOUNT_SID, context.AUTH_TOKEN);
    await loadServerlessModules();
    const result = await driver(context, event, twilioClient);

    return callback(null, result);
  } catch (e) {
    return callback(e);
  }
};

const loadServerlessModules = async () => {
  try {
    const functions = Runtime.getFunctions();
    const serverlessHelperPath = functions['private/boilerplate/helper'].path;

    serverlessHelper = require(serverlessHelperPath);
  } catch (e) {
    throw e;
  }
}

const driver = async(serverlessContext, serverlessEvent, twilioClient) => {
  try {
    const phoneNumbersLimit = serverlessEvent.limit ? serverlessEvent.limit : 1;
    const result = await phoneNumberBuyingDriverRecursive(serverlessContext, serverlessEvent, twilioClient, [], phoneNumbersLimit);
    return result;
  } catch (e) {
    throw serverlessHelper.formatErrorMsg(serverlessContext, 'driver', e);
  }
}

const phoneNumberBuyingDriverRecursive = async (serverlessContext, serverlessEvent, twilioClient, phoneNumbers = [], phoneNumbersLimit = 1, callStackTracker = 0) => {
  try {
    const availablePhoneNumbers = await getPhoneNumbers(serverlessContext, serverlessEvent, twilioClient, phoneNumbersLimit);
    const result = [...phoneNumbers];

    for(const anAvailablePhoneNumber of availablePhoneNumbers) {
      try {
        const aPhoneNumber = await buyPhoneNumbers(serverlessContext, serverlessEvent, twilioClient, anAvailablePhoneNumber);
        result.push(aPhoneNumber);
      } catch(e) {
        if(e != ERROR_NOT_AVAILABLE_PHONE_NUMBER) {
          throw e;
        }
      }
    }

    if(result.length < phoneNumbersLimit && callStackTracker < CALL_STACK_LIMIT) {
      const newPhoneNumberLimit = phoneNumbersLimit - result.length;
      const newCallStackTracker = callStackTracker + 1;
      return await phoneNumberBuyingDriverRecursive(serverlessContext, serverlessEvent, twilioClient, result, newPhoneNumberLimit, newCallStackTracker);
    }

    return result;
  } catch (e) {
    throw serverlessHelper.formatErrorMsg(serverlessContext, 'phoneNumberBuyingDriverRecursive', e);
  }
}

const getPhoneNumberSettings = () => {
  try {
    const result = {
      smsEnabled: true,
      mmsEnabled: true,
      voiceEnabled: true,
      excludeAllAddressRequired: true,
      excludeLocalAddressRequired: true,
      excludeForeignAddressRequired: true,
      beta: false
    };
    return result;
  } catch (e) {
    throw serverlessHelper.formatErrorMsg(serverlessContext, 'getPhoneNumberSettings', e);
  }
}

const getPhoneNumbers = async(serverlessContext, serverlessEvent, twilioClient, phoneNumbersLimit) => {
  try {
    const setting = serverlessEvent.phoneNumberSettings ? {...serverlessEvent.phoneNumberSettings} : getPhoneNumberSettings();
    setting.limit = phoneNumbersLimit;

    const availablePhoneNumbers = await twilioClient
      .availablePhoneNumbers('US')
      .local
      .list(setting);
    
    return availablePhoneNumbers;
  } catch (e) {
    throw serverlessHelper.formatErrorMsg(serverlessContext, 'getPhoneNumbers', e);
  }
}

const buyPhoneNumbers = async(serverlessContext, serverlessEvent, twilioClient, anAvailablePhoneNumber) => {
  try {
    const { phoneNumber } = anAvailablePhoneNumber;
    const result = await twilioClient
      .incomingPhoneNumbers
      .create({phoneNumber});
    return result;
  } catch (e) {
    throw ERROR_NOT_AVAILABLE_PHONE_NUMBER;
  }
}