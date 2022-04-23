const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/register/", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const lenOfPass = password.length;
    if (lenOfPass >= 6) {
      const hashedPassword = await bcrypt.hash(request.body.password, 10);
      const selectUserQuery = `
    SELECT 
    * 
    FROM user 
    WHERE 
    username = '${username}'`;
      const dbUser = await db.get(selectUserQuery);
      if (dbUser === undefined) {
        const createUserQuery = `
      INSERT INTO
        user (username, password, name, gender)
      VALUES
        (
          '${username}',
          '${hashedPassword}',
          '${name}',
          '${gender}'
        )`;
        const dbResponse = await db.run(createUserQuery);
        const newUserId = dbResponse.lastID;
        response.send("User created successfully");
      } else {
        response.status(400);
        response.send("User already exists");
      }
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } catch (err) {
    console.log(err.message);
  }
});

app.post("/login/", async (request, response) => {
  try {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid user");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "ajajuajjajuu");
        response.send({ jwtToken });
      } else {
        response.status(400);
        response.send("Invalid password");
      }
    }
  } catch (err) {
    console.log(err.message);
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "ajajuajjajuu", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const loggedUser = request.username;
  const selectUserQuery = `SELECT user_id FROM user WHERE username = '${loggedUser}'`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  const getTweetsQuery = `
    SELECT 
      username, tweet, date_time as dateTime
    FROM user 
      INNER JOIN tweet ON user.user_id = tweet.user_id
      INNER JOIN follower ON tweet.user_id = follower.follower_id
    WHERE 
      follower.follower_user_id = ${dbUser.user_id}
    ORDER BY 
        dateTime DESC
    LIMIT 4; 
    `;
  const tweetsArray = await db.all(getTweetsQuery);
  response.send(tweetsArray);
});

app.get("/user/following/", authenticateToken, async (request, response) => {
  const loggedUser = request.username;
  const selectUserQuery = `SELECT user_id FROM user WHERE username = '${loggedUser}'`;
  const dbUser = await db.get(selectUserQuery);

  const getFollowingQuery = `
    SELECT name 
    FROM user 
    INNER JOIN follower ON ${dbUser.user_id} = follower.follower_id
    WHERE 
      follower.following_user_id
    `;
  const followingData = await db.all(getFollowingQuery);
  response.send(followingData);
});

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const loggedUser = request.username;
  const selectUserQuery = `SELECT user_id FROM user WHERE username = '${loggedUser}'`;
  const dbUser = await db.get(selectUserQuery);

  const getFollowerQuery = `
    SELECT user.name FROM 
    user INNER JOIN follower ON ${dbUser.user_id} = follower.follower_id
    WHERE 
      follower.follower_user_id
    `;
  const followerData = await db.all(getFollowerQuery);
  response.send(followerData);
});

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweetId } = request.body;
  const getFollowerTable = `
  SELECT DISTINCT (following_user_id) as followingUserId 
  FROM 
  follower
  `;
  const followerTable = await db.all(getFollowerTable);
  console.log(followerTable);

  const getIdTweet = `
    SELECT 
      tweet, 
      count(like_id) as likes, 
      count(reply) as replies, 
      date_time as dateTime
    FROM 
    tweet 
    INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN like ON reply.tweet_id = like.tweet_id
    `;
  const idTweetData = await db.all(getIdTweet);
  response.send(idTweetData);
});

/*
if (tweetId !== following_user_id) {
    response.status(400);
    response.send("Invalid Request");
  } else {
*/

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const getIdTweet = `
    SELECT 
      tweet, 
      count(like_id) as likes,
      count(reply) as replies, 
      date_time as dateTime
    FROM 
    tweet 
    INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN like ON reply.tweet_id = like.tweet_id
    `;
  const idTweetData = await db.all(getIdTweet);
  response.send(idTweetData);
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const getIdTweet = `
    SELECT 
      tweet, 
      count(like_id) as likes, 
      count(reply) as replies, 
      date_time as dateTime
    FROM 
    tweet 
    INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN like ON reply.tweet_id = like.tweet_id
    `;
    const idTweetData = await db.all(getIdTweet);
    response.send(idTweetData);
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const getIdTweet = `
    SELECT 
      tweet, 
      count(like_id) as likes, 
      count(reply) as replies, 
      date_time as dateTime
    FROM 
    tweet 
    INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN like ON reply.tweet_id = like.tweet_id
    `;
    const idTweetData = await db.all(getIdTweet);
    response.send(idTweetData);
  }
);

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  try {
    const { tweet } = request.body;
    const postTweet = `
    INSERT INTO tweet
    VALUE (
        '${tweet}'
    )
    `;
    const dbResponse = await db.run(postTweet);
    const newUserId = dbResponse.lastID;
    response.send("Created a Tweet");
  } catch (err) {
    response.send(err);
  }
});

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetQuery = `
    DELETE FROM
      tweet
    WHERE
      tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
);

module.exports = app;
