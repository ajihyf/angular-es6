const unitContext = require.context('.', true, /\.spec\.js$/)
unitContext.keys().forEach(unitContext)
