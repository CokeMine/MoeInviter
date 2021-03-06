const Router = require('koa-router');
const axios = require('axios');
const router = new Router();
const {organizationName, orgUserName, Oauth, userName, personalToken, avatarURL} = require('./config.json');
const {clientID, clientSecret} = Oauth;
const auth = {};
router.get('/', async ctx => await ctx.render('welcome', {
    avatarURL,
    organizationName
}));

router.get('/github/login', async ctx => ctx.redirect(`https://github.com/login/oauth/authorize?client_id=${clientID}`));

router.get('/oauth/redirect', async ctx => {
    const requestToken = ctx.request.query.code;
    let res = await axios.post('https://github.com/login/oauth/access_token', {
        "client_id": clientID,
        "client_secret": clientSecret,
        "code": requestToken
    }, {
        "headers": {
            "Accept": "application/json"
        }
    });
    if (res.data["error"]) {
        throw({status: 500, message: res.data["error"]});
    } else {
        const accessToken = res.data["access_token"];
        res = await axios.get('https://api.github.com/user', {
            "headers": {
                "Authorization": `token ${accessToken}`
            }
        });
        let {login, avatar_url, name, id} = res.data;
        if (!name) name = login;
        if (!auth[login]) auth[login] = {}
        auth[login]["requestToken"] = requestToken;
        auth[login]["id"] = id;
        auth[login]["avatar_url"] = avatar_url;
        auth[login]["name"] = name;
        await ctx.render('join', {
            organizationName,
            avatar_url,
            name,
            login
        });
    }
});

router.get('/join', async ctx => {
    const referer = ctx.request.header['referer'];
    const login = ctx.request.query['login'];
    if (!referer || !login) {
        throw({
            status: 403,
            message: "再检查一下？"
        });
    }
    const myURL = new URL(referer);
    const code = myURL.searchParams.get('code');
    if (!code || !myURL || !auth[login] || auth[login]["requestToken"] !== code) {
        throw({
            status: 403,
            message: "再检查一下？"
        });
    }
    if (auth[login]["status"]) {
        throw({
            status: 403,
            message: "已经邀请过你啦！"
        })
    }
    const res = await axios.post(`https://api.github.com/orgs/${orgUserName}/invitations`, {
        "invitee_id": auth[login]["id"],
        "role": "direct_member"
    }, {
        headers: {
            "Accept": "application/vnd.github.v3+json",
        },
        auth: {
            username: userName,
            password: personalToken
        }
    });
    auth[login]["status"] = true;
    await ctx.render('redirect', {
        organizationName,
        orgUserName,
        name: auth[login]["name"],
        avatar_url: auth[login]["avatar_url"]
    })
});

module.exports = router
