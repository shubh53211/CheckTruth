const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

// async function abstraction
async function getStatement(statementCreatorId, statementId) {
  console.log('statementCreatorId:', JSON.stringify(statementCreatorId));
  console.log('statementId:', statementId);
  var params = {
    TableName: "statements",
    Key: {
        "creatorId": statementCreatorId,
        "statementId": statementId
    }
  }
  console.log('getStatement: params passed to statement table:', JSON.stringify(params));
  var statement = await dynamo.get(params).promise()
  console.log('getStatement: response:', JSON.stringify(statement, null, 2));
  return statement
}

async function getVotes(statementCreatorId, statementId) {
    console.log('getVotes: statementCreatorId:', statementCreatorId);
    console.log('getVotes: statementId:', statementId);
  
    var params = {
        TableName: 'votes',
        KeyConditionExpression: 'statementCreatorId = :partitionKey and statementId = :sortKey',
        ExpressionAttributeValues: {
            ':partitionKey': statementCreatorId,
            ':sortKey': statementId
        }
    };

  console.log('getVotes: params passed to voters table:', JSON.stringify(params));
  var result = await dynamo.query(params).promise()
  console.log('getVotes: response from the voters table:', JSON.stringify(result));
  return result
}

async function updateStatement(statement) {
    console.log('updateStatement: ', JSON.stringify(statement));

    var params = {
        TableName: "statements",
        Item: statement
    }
    await dynamo.put(params).promise()
}

async function getVoter(voterId) {
    console.log('getVoter: voterId:', voterId);
  
    var params = {
        TableName: "voters",
        Key: {
            "voterId": voterId
        }
    }
    console.log('getVoter: params passed to voters table:', JSON.stringify(params));
    var resp = await dynamo.get(params).promise();
    return resp;
}

/**
 * Provide an event that contains the following keys:
 *
 *   - operation: one of the operations in the switch statement below
 *   - tableName: required for operations that interact with DynamoDB
 *   - payload: a parameter to pass to the operation being performed
 */
exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // get the statement
    try {
        var statementResp = await getStatement(event.statementCreatorId, event.statementId)
        
        if( !statementResp.hasOwnProperty("Item")) {
            // cannot find the statement being voted on
            console.log('Statement does not exist.');
            return;
        }
        
        if( statementResp.Item.inActive == true ) {
            // The statement's truth value has already been assigned
            console.log('The truth value of the statement has already been finalized.');
            return;
        }
        
        // get all the votes cast on this statement
        var votesResp = await getVotes(event.statementCreatorId, event.statementId)
        
        // update the reputation of all the voters
        for (var i = 0; i < votesResp.Count; i++) {
            var vote = votesResp.Items[i];
            //update the reputation of this voter
            
            var voterId = vote.voterId;
            var voteValue = vote.voteValue;
            
            // get the voter
            var voterResp = await getVoter(voterId)
            
            if( !voterResp.hasOwnProperty("Item")) {
                // cannot find the voter
                console.log('Voter does not exist: ', voterId);
                continue;
            }
            
            var voter = voterResp.Item;
            
            //update the voter's reputation
            if( Math.abs(event.truthValue - voteValue) > 0.5 ) {
                voter.reputation *= 0.5; // reduce the voter's reputation by half
            } else {
                if( Math.abs(event.truthValue - voteValue) <= 0.1 ) {
                    voter.reputation += 0.1;
                    if( voter.reputation > 1.0 ) {
                        voter.reputation = 1.0;
                    }
                }
            }
            
            var params = {
                TableName: "voters",
                Item: voter
            }
            await dynamo.put(params).promise()
            console.log('Updated voter after reputation change:', JSON.stringify(voter));
        }
        
        // assign the truthValue to the statement and mark it as inactive
        var statement = statementResp.Item;
        statement.truthValue = event.truthValue;
        statement.inActive = true;

        // store the updated statement in the table
        await updateStatement(statement);
        return statement
    } catch (err) {
        return err
    }
};
