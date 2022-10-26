const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

// async function abstraction
async function getStatement(statementCreatorId, statementId) {
  var params = {
    TableName: "statements",
    Key: {
        "creatorId": statementCreatorId,
        "statementId": statementId
    }
  }
  console.log('getStatement: params :', JSON.stringify(params));
  var statement = await dynamo.get(params).promise()
  console.log('getStatement: response :', JSON.stringify(statement));
  return statement
}

async function addStatement(statement) {
    var params = {
        TableName: "statements",
        Item: statement
    }
    console.log('addStatement: params:', JSON.stringify(params));
    var resp = await dynamo.put(params).promise()
    console.log('addStatement: response:', JSON.stringify(resp));
    return resp
}

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    try {
        var statementResp = await getStatement(event.item.creatorId, event.item.statementId)
        if( statementResp.hasOwnProperty("Item")) {
            // the statement already exists
            console.log('Statement already exists');
            return;
        }
        
        // add the statement in "statements" table
        statementResp = await addStatement(event.item)
        return statementResp;
    } catch (err) {
        return err
    }
};
