import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE || './qcvp.db')
const num = process.argv[2]
console.log('orders rows:', db.prepare("SELECT order_number, status, merged_into_order_number, email FROM orders WHERE order_number=?").all(num))
console.log('order_items rows:', db.prepare("SELECT COUNT(*) c FROM order_items WHERE order_number=? OR merged_from_order_number=?").all(num, num))
console.log('order_items detail:', db.prepare("SELECT id, order_number, merged_from_order_number, sku, status FROM order_items WHERE order_number=? OR merged_from_order_number=?").all(num, num))
