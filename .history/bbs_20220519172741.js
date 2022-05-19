
const express = require('express')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const { stopped } = require('init')
const { posix } = require('path')
const { ifError } = require('assert')
const uuid = require('uuid').v4

const port = 8080

const app = express()

app.set('views',__dirname + '/tamplates')  // 设置模板文件夹为

const users = JSON.parse(fs.readFileSync('./users.json'))   // 存储用户信息的文件 只是拿到了源代码 要解析成对象
const posts = JSON.parse(fs.readFileSync('./posts.json'))   // 存储帖子信息
const comments = JSON.parse(fs.readFileSync('./comments.json'))   // 存储帖子

app.use((req,res,next) => {
  console.log(req.method,req.url)
  next()
})

app.use(express.urlencoded({extended:true}))  // 能够解析扩展express的请求体
app.use(cookieParser('asdasasd'))    // 生成签名的种子

app.use((req,res,next) => {
  console.log(req.cookies,req.signedCookies)  // 读取cookie
  next()
})

app.get('/',(req,res,next) => {   // get首页
  res.type('html')
  if (req.signedCookies.loginName) {  // 如果有签了名的loginName
    res.write(`
      <div><a href="/">homepage</a></div>
      <div>welcome,${req.signedCookies.loginName}</div>
      <div><a href="/add-post">Add post</a></div>
      <div><a href="/logout">logout</a></div>
    `)
  } else {
    res.write(`
      <div><a href="/">homepage</a></div>
      <div><a href="/register">register</a></div>
      <div><a href="/login">login</a></div>
    `)
  }

  res.write('<hr>')
  for (var post of posts) {
    res.write(`
      <div>
        <a href="/post/${post.id}">${post.title}</a>
      </div>
    `)
  }
})

app.get('/add-post',(req,res,next) => {  // 发帖
  res.type('html')
  res.end(`
    <h1>发帖</h1>
    <form action="/add-post" method="post">
      Title: <br>
      <input type:"text" name="title"/><br>
      Content: <br>
      <textarea name="content" cols="30" rows="8"></textarea><br>
      <button>Post</button>
    </form>
  `)
})

app.post('/add-post',(req,res,next) => {  // 根据用户名发帖
  if (req.signedCookies.loginName) {  // 签了名的用户 当前用户的用户名
    var postInfo = req.body
    var post = {
      id:uuid(),
      title: postInfo.title,
      content: postInfo.content,
      timestamp: new Date().toISOString(),
      owner: req.signedCookies.loginName,
    }

    posts.push(post)
    fs.writeFileSync('./posts.json',JSON.stringify(posts,null,2))

    res.end('post ok')
  } else {
    res.end('only logged in uesr can post')
  }
})

app.get('/post/:id',(req,res,next) => {   // 发帖人信息和发帖 以及评论 评论人信息
  var postId = req.params.id
  var post = posts.find(it => it.id == req.params.id)  // 帖子id
  res.type('html')
  if (post) {
    res.write( eval(fs.readFileSync('./post.tpl','utf-8')))

    res.write('<hr>')

    //显示评论  以及评论人信息
    const thisComments = comments.filter(it => it.postId == postId)
    for (let comment of thisComments) {
      res.write(`
        <p>${comment.content} <a href="/user/${comment.owner}">@${comment.owner}</a></p>
      `)
    }

    res.write('<hr>')

    if (req.signedCookies.loginName) {
      res.write(`
        <p>评论</p>
        <form action="/comment/${req.params.id}" method="post">
          <textarea name="content"></textarea>
          <button>Submit</button>
        </form>
      `)
    }else {
      res.write('想评论？请<a href="/login">登录</a> ')
    }
  } else {
    res.end('no found this post')
  }
})

app.post('/comment/:postId',(req,res,next) => {  // 评论人信息
  var commentInfo = req.body
  var postId = req.params.postId
  if (req.signedCookies.loginName) {
    var comment = {
      id: uuid(),
      content: commentInfo.content,   // 帖子内容
      timestamp: new Date().toISOString(),
      owner: req.signedCookies.loginName,   // 用户id
      postId: req.params.postId,   // 帖子id
    }

    comments.push(comment)
    res.redirect(`/post/${postId}`)
    fs.writeFileSync('./comments.json',JSON.stringify(comments,null,2))

  } else {
    res.end('please login to comment')
  }
})

app.get('/user/:userName',(req,res,next) => {  // 用户主页
  var userName = req.params.userName
  var user = users.find(it => it.name == userName)

  res.type('html')
  if (user) {
    res.write(`
      <img class="avatar" src="xxx">
      <h2>${userName}</h2>
      <hr>
      <h3>发过的帖子</h3>
    `)

    // 发过的帖子
    var thisPosts = posts.filter(it => it.owner == userName)

    for (var post of thisPosts) {
      res.write(`
        <div>
          <a href="/post/${post.id}">${post.title}</a>
        </div>
      `)
    }

    // 回复过的评论
    res.write(`
      <h2>回复过的评论</h2>
    `)
    var thisComments = comments.filter(it => it.owner == userName)
    for (var comment of thisComments) {
      res.write(`
        <div>
          <a href="/post/${comment.postId}">标题</a>
          <br>
          ${comment.content}
          <hr>
        </div>
      `)
    }

    res.end()

  } else {
    res.type('html')
    res.end('查无此人')
  }
})

app.get('/register',(req,res,next) => {   // 注册页面
  res.type('html')
  res.end(`
    <h1>Register</h1>
    <form action="/register" method="post">
      <div>Name:<input type="text" name="name"></div>
      <div>Email:<input type="email" name="email"></div>
      <div>Password:<input type="password" name="password"></div>
      <div>Password:<input type="password" name="password1"></div>
      <button>Submit</button>
    </form>
  `)   // 表单提交可以控制在浏览器使用表单时候的请求方法
})

app.post('/register',(req,res,netx) => {   // 判断用户名,邮箱是否存在 ,两次密码是不是一致
  var regInfo = req.body

  if (regInfo.password !== regInfo.password1) {
    res.end('two password not equal')
    return
  }

  if (users.some(it => it.name == regInfo.name)) {
    res.end('usename already exists')
    return
  }

  if (users.some(it => it.email == regInfo.email)) {
    res.end('usename already exists')
    return
  }

  var user = {     // 存储用户信息
    name: regInfo.name,
    email: regInfo.email,
    password: regInfo.password,
  }

  users.push(user)
  res.type('html').end('register success,go<a href:"/login">login</a>')
  fs.writeFileSync('./users.json',JSON.stringify(users,null,2))   // 如果注册成功 写到users.json中  存储的时候缩进 属性名换行
})

app.get('/login',(req,res,next) => {   // 登录页面
  res.type('html')
  res.end(`
    <h1>Login</h1>
    <form action="/login" method="post">
      <div>Name:<input type="text" name="name"></div>
      <div>Password:<input type="password" name="password"></div>
      <button>Submit</button>
    </form>
  `)
})

app.post('/login',(req,res,next) => {   // 判断是否登录成功
  var loginInfo = req.body

  var target = users.find(it => it.name == loginInfo.name && it.password == loginInfo.password)  // 在users库中匹配用户名和密码

  if (target) {
    res.cookie('loginName',target.name,{
      maxAge:86400000,    // 最大有效期
      signed:true,      //签名之后发送
    })
    res.redirect('/')    // 返回首页
  } else {  // 匹配不上
    res.end('username or password incorret')
  }
})

app.get('/logout',(req,res,next) => {   // 登出
  res.clearCookie('loginName')  // 清除cookie
  res.redirect('/')         // 重新回到首页
})


app.listen(port,'127.0.0.1',() => {
  console.log('listening on',port)
})
