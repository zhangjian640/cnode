const path = require('path')
const axios = require('axios')
const webpack = require('webpack')
const MemoryFs = require('memory-fs')
const proxy = require('http-proxy-middleware')
const ReactDomServer = require('react-dom/server')
const serverConfig = require('../../build/webpack.config.server')
let serverBundle

const getTemplate = () => {
  return new Promise ((resolve, reject) => {
    axios.get('http://localhost:8888/public/index.html')
      .then(res=>{
        resolve(res.data)
      })
      .catch(reject)
  })
}

const Module = module.constructor

const mfs = new MemoryFs
const serverCompiler = webpack(serverConfig)
serverCompiler.outputFileSystem = mfs
serverCompiler.watch({}, (err, stats)=>{
  if (err) {
    throw err
  }
  stats = stats.toJson()
  stats.errors.forEach(err=> console.error(err))
  stats.warnings.forEach(warn => console.warn(warn))

  const bundlePath = path.join(
    serverConfig.output.path,
    serverConfig.output.filename
  )
  const bundle = mfs.readFileSync(bundlePath, 'utf8')
  const m = new Module()
  m._compile(bundle, 'server.entry.js')
  serverBundle = m.exports.default

})

module.exports = function (app) {

  // 获取的打包后的js文件，是html，由于在内存中获取，不能像在express中设置静态文件目录。方法是使用代理
  app.use('/public', proxy({
    target: 'http://localhost:8888'
  }))

  app.get('*', function (req, res) {
    getTemplate().then(template=> {
      const content = ReactDomServer.renderToString(serverBundle)
      res.send(template.replace('<!-- app -->', content))
    })
  })
}