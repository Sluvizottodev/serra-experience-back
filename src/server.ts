import 'dotenv/config'
import { app } from './app'
import { env } from './common/config/env'

const PORT = Number(env.PORT)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${env.NODE_ENV}]`)
})
