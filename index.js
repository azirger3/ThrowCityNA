const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();
app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.
app.use(express.static('resources'))

//Database setup
const dbConfig = {
    host: 'db', 
    port: 5432, 
    database: process.env.POSTGRES_DB, 
    user: process.env.POSTGRES_USER, 
    password: process.env.POSTGRES_PASSWORD, 
  };
const db = pgp(dbConfig);
db.connect() //realistically database will only get used later but it's here for that time
  .then(obj => {
    console.log('Database connection successful'); 
    obj.done(); 
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

app.get("/acctIDByAcctTag", (req, res) => {
    const username = req.body.username;
    const tag = req.body.tag;
    axios.get(`https://api.henrikdev.xyz/valorant/v1/account/${username}/${tag}`)
    .then(results => {
        console.log(results.data.data.puuid);
        res.status(201).json({
            status: 'success',
            data: results.data.data,
            message: 'data fetched successfully',
        });
    })
    .catch(error => {
        res.send(error);
    });
});

app.get("/matchByMatchID", (req, res) => {
    const mID = req.body.mID;
    axios.get(`https://api.henrikdev.xyz/valorant/v2/match/${mID}`)
    .then(results => {
        // Finding Agents used by A and B for NM W/L
        var AAgents = [];
        var BAgents = [];
        for(player in results.data.data.players.red) {
            AAgents.push(results.data.data.players.red[player].character);
        }
        for(player in results.data.data.players.blue) {
            BAgents.push(results.data.data.players.blue[player].character);
        }

        /* Finding First Kill/First death/KAST particitpations by player as a note, KAST = KAST participation/rounds 
        Set up as array of length 10 (number of players) of arrays of length 4 [Player puuid, FK, FD, KAST participation] */
        var statsArr = [];
        var KASTcontributions = []; // Array of data in the form [puuid, KASTcontribution?, kill?, assist?, death time, killer, killer death time]
        var FKpuuid;
        var FDpuuid;
        var FKTime;
        var killer;
        var victim;
        for (player in results.data.data.players.red) {
            statsArr.push([results.data.data.players.red[player].puuid,0,0,0]);
            KASTcontributions.push([results.data.data.players.red[player].puuid,false,false,false,0,'',1000000]);
        }
        for (player in results.data.data.players.blue) {
            statsArr.push([results.data.data.players.blue[player].puuid,0,0,0]);
            KASTcontributions.push([results.data.data.players.blue[player].puuid,false,false,false,0,'',1000000]);
        }
        for (round in results.data.data.rounds) {
            //Resetting round by round data
            FKpuuid = ''; //Realistically these don't need to be reset, just for the very slim edge case of a round with no kills
            FDpuuid = '';
            FKTime = 1000000; //Just needs to be larger than the length of a round in ms. 1000s>max round length
            for (cont in KASTcontributions) {
                KASTcontributions[cont][1] = false;
                KASTcontributions[cont][2] = false;
                KASTcontributions[cont][3] = false;
                KASTcontributions[cont][4] = 0;
                KASTcontributions[cont][5] = '';
                KASTcontributions[cont][6] = 1000000;
            }
            for (playerStat in results.data.data.rounds[round].player_stats) {
                console.log(results.data.data.rounds[round].player_stats[playerStat].kills);
                console.log(results.data.data.rounds[round].player_stats[playerStat].kills > 0);
                if (results.data.data.rounds[round].player_stats[playerStat].kills > 0) {
                    //First kill and first death. We only need to check each players first kill as kills are sorted chronologically
                    console.log('AAAAAAAAAAAAAAAAAAAAAAA');
                    console.log(results.data.data.rounds[round].player_stats[playerStat].kill_events[0].kill_time_in_round);
                    console.log('BBBBBBBBBBBBBBBBBBBBBBB');
                    console.log(FKTime);
                    if (results.data.data.rounds[round].player_stats[playerStat].kill_events[0].kill_time_in_round < FKTime) {
                        FKTime = results.data.data.rounds[round].player_stats[playerStat].kill_events[0].kill_time_in_round;
                        FKpuuid = results.data.data.rounds[round].player_stats[playerStat].kill_events[0].killer_puuid;
                        FDpuuid = results.data.data.rounds[round].player_stats[playerStat].kill_events[0].victim_puuid;
                    }
                    // KAST kills, survival, and trades
                    /*for (player in KASTcontributions) {
                        if (KASTcontributions[player][0] == results.data.data.rounds[round].player_stats[playerStat].player_puuid) {
                            killer = KASTcontributions[player];
                            break;
                        }
                    }
                    for (kill in results.data.data.rounds[round].player_stats[playerStat].kill_events) {
                        for (player in KASTcontributions) {
                            if (KASTcontributions[player][0] == results.data.data.rounds[round].player_stats[playerStat].kill_events[kill].victim_puuid) {
                                victim = KASTcontributions[player];
                                break;
                            }
                        }
                        if (victim != killer) {
                            victim[5] = killer[0];
                            victim[4] = results.data.data.rounds[round].player_stats[playerStat].kill_events[kill].kill_time_in_round;
                            killer[2] = true;
                            for (player in KASTcontributions) {
                                if (KASTcontributions[player][5] == victim[0]) {
                                    KASTcontributions[player][6] = results.data.data.rounds[round].player_stats[playerStat].kill_events[kill].kill_time_in_round;
                                }
                            }
                        }
                        //KAST assists
                        for (assistant in results.data.data.rounds[round].player_stats[playerStat].kill_events[kill].assistants) {
                            for (player in KASTcontributions) {
                                if (KASTcontributions[player][0] == results.data.data.rounds[round].player_stats[playerStat].kill_events[kill].assistants[assistant].assistant_puuid) {
                                    KASTcontributions[player][3] = true;
                                }
                            }
                        }
                    }*/
                }
            }
            // Updating FK, FD, and KAST
            console.log(FKpuuid);
            console.log(FDpuuid);
            for (player in statsArr) {
                if (statsArr[player][0] == FKpuuid) {
                    statsArr[player][1]++;
                }
                if (statsArr[player][0] == FDpuuid) {
                    statsArr[player][2]++;
                }
                /*for (KCon in KASTcontributions) {
                    if (KASTcontributions[KCon][0] == statsArr[player][0]) {
                        if (KASTcontributions[KCon][2] || KASTcontributions[KCon][3] || (KASTcontributions[KCon][5] == '') || (KASTcontributions[KCon][6] - KASTcontributions[KCon][4] < 5000)) {
                            statsArr[player][3]++;
                        }
                    }
                }*/
            }
        }

        // Finding Winning/Losing Rounds + OT Rounds. Yes there is probably a better way of coding this before you ask why I did it this way.
        var AWins = 0;
        var AAtkWins = 0;
        var ADefWins = 0;
        var AOTWins = 0;
        var BWins = 0;
        var BAtkWins = 0;
        var BDefWins = 0;
        var BOTWins = 0;
        for (round in results.data.data.rounds) {
            if (round < 12) {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    AAtkWins++;
                } else {
                    BWins++;
                    BDefWins++;
                }
            } else if (round < 24) {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    ADefWins++;
                } else {
                    BWins++;
                    BAtkWins++;
                }
            } else {
                if (results.data.data.rounds[round].winning_team == "Red") {
                    AWins++;
                    AOTWins++;
                } else {
                    BWins++;
                    BOTWins++;
                }
            }
        }
        var rounds = AWins+BWins;
        var winner;
        if (AWins > BWins) {
            winner = 'A';
        } else if (AWins < BWins) {
            winner = 'B';
        }

        //Creating return data structure
        var returnData = {};
        // Creating top bar of spreadsheet
        var topBar = ['Players','Notes','Teams','Score','Attacking Rounds Won','Defending Rounds Won','OT Rounds Won','Agents Played','Agents that won','NM Agents that won','Agents that lost','NM Agents that lost','ACS','Kills','Deaths','Assists','K/D Ratio','KAST','FK','FD','Winners?']
        returnData.topBar = topBar;
        // Adding players to respective teams
        var TeamA = [];
        returnData.TeamA = TeamA;
        for(player in results.data.data.players.red) {
            var aW = '';
            var aNMW = '';
            var aL = '';
            var aNML = '';
            if (winner == 'A') {
                aW = results.data.data.players.red[player].character;
                if (!(BAgents.includes(results.data.data.players.red[player].character))) {
                    aNMW = results.data.data.players.red[player].character;
                }
            } else {
                aL = results.data.data.players.red[player].character;
                if (!(BAgents.includes(results.data.data.players.red[player].character))) {
                    aNML = results.data.data.players.red[player].character;
                }
            }

            var playerArr = [];
            playerArr.push(`${results.data.data.players.red[player].name} #${results.data.data.players.red[player].tag}`);
            playerArr.push('notes'); //remove notes at end, just for spacing
            playerArr.push('Team 1');
            playerArr.push(`${AWins}-${BWins}`);
            playerArr.push(AAtkWins);
            playerArr.push(ADefWins);
            playerArr.push(AOTWins);
            playerArr.push(results.data.data.players.red[player].character);
            playerArr.push(aW);
            playerArr.push(aNMW);
            playerArr.push(aL);
            playerArr.push(aNML);
            playerArr.push((results.data.data.players.red[player].stats.score/rounds).toFixed(0));
            playerArr.push(results.data.data.players.red[player].stats.kills);
            playerArr.push(results.data.data.players.red[player].stats.deaths);
            playerArr.push(results.data.data.players.red[player].stats.assists);
            playerArr.push((results.data.data.players.red[player].stats.kills/results.data.data.players.red[player].stats.deaths).toFixed(1));
            for (play in statsArr) {
                if (statsArr[play][0] == results.data.data.players.red[player].puuid) {
                    playerArr.push((statsArr[play][3]*100/rounds).toFixed(0)); 
                    playerArr.push(statsArr[play][1]); 
                    playerArr.push(statsArr[play][2]); 
                    break;
                }
            }
            playerArr.push('A' == winner);
            returnData.TeamA.push(playerArr);
        }
        var TeamB = [];
        returnData.TeamB = TeamB;
        for(player in results.data.data.players.blue) {
            var aW = '';
            var aNMW = '';
            var aL = '';
            var aNML = '';
            if (winner == 'B') {
                aW = results.data.data.players.blue[player].character;
                if (!(AAgents.includes(results.data.data.players.blue[player].character))) {
                    aNMW = results.data.data.players.blue[player].character;
                }
            } else {
                aL = results.data.data.players.blue[player].character;
                if (!(AAgents.includes(results.data.data.players.blue[player].character))) {
                    aNML = results.data.data.players.blue[player].character;
                }
            }

            var playerArr = [];
            playerArr.push(`${results.data.data.players.blue[player].name} #${results.data.data.players.blue[player].tag}`);
            playerArr.push('notes'); //remove notes at end, just for spacing
            playerArr.push('Team 2');
            playerArr.push(`${AWins}-${BWins}`);
            playerArr.push(BAtkWins);
            playerArr.push(BDefWins);
            playerArr.push(BOTWins);
            playerArr.push(results.data.data.players.blue[player].character);
            playerArr.push(aW);
            playerArr.push(aNMW);
            playerArr.push(aL);
            playerArr.push(aNML);
            playerArr.push((results.data.data.players.blue[player].stats.score/rounds).toFixed(0));
            playerArr.push(results.data.data.players.blue[player].stats.kills);
            playerArr.push(results.data.data.players.blue[player].stats.deaths);
            playerArr.push(results.data.data.players.blue[player].stats.assists);
            playerArr.push((results.data.data.players.blue[player].stats.kills/results.data.data.players.blue[player].stats.deaths).toFixed(1));
            for (play in statsArr) {
                if (statsArr[play][0] == results.data.data.players.blue[player].puuid) {
                    playerArr.push((statsArr[play][3]*100/rounds).toFixed(0)); 
                    playerArr.push(statsArr[play][1]); 
                    playerArr.push(statsArr[play][2]); 
                    break;
                }
            }
            playerArr.push('B' == winner);
            returnData.TeamB.push(playerArr);
        }
        //console.log(returnData);
        /*console.log(AAgents);
        console.log(BAgents);
        console.log(results.data.data.players.blue[0].character);
        console.log((AAgents.includes(results.data.data.players.blue[0].character)));*/

        res.status(201).json({
            status: 'success',
            usefulData: returnData,
            data: results.data.data,
            message: 'data fetched successfully',
        });
    })
    .catch(error => {
        res.send(error);
    });
});

app.listen(3000);
console.log('Server is listening on port 3000');