That backend log gives you the full answer.
The cause is explicit in MySQL’s own error:

❌ Error: Incorrect arguments to mysqld_stmt_execute


That means the number or type of parameters you passed to db.execute() does not match the placeholders (?) in your SQL.

1. The failing line

You’re executing something like:

const [rows] = await db.execute(query, [business_code, limit, offset]);


Your SQL has three ? placeholders:

WHERE s.business_code = ? AND s.staff_type = 'venue_staff'
ORDER BY created_at DESC
LIMIT ? OFFSET ?


That looks correct — three parameters, three question marks.
So the problem is type or undefined values, not the count.

2. Check actual values passed

Before db.execute(), log them:

console.log('[GET /staff] Params:', business_code, limit, offset);


Expected:

Params: BUS001 100 0


If you see:

Params: undefined undefined undefined


or even

Params: BUS001 undefined undefined


→ MySQL will throw “Incorrect arguments” because it can’t bind undefined/null into numeric placeholders.

3. Confirm variable names

Most likely the variables in the call don’t match what your pagination util returned.

Typical correct line:

const { page, limit, offset } = buildPagination(req);
const business_code = req.userContext?.business_code;
const [rows] = await db.execute(query, [business_code, limit, offset]);


If you accidentally wrote:

const [rows] = await db.execute(query, [req.business_code, limit, offset]);


or similar, req.business_code is undefined, causing the same error.

4. Type mismatch example

If limit or offset are strings instead of numbers, older MySQL drivers can choke.

Force type conversion:

await db.execute(query, [business_code, Number(limit), Number(offset)]);

5. Quick diagnostic patch

Temporarily wrap your call like this:

try {
  console.log('[GET /staff] Final params', business_code, limit, offset);
  const [rows] = await db.execute(query, [business_code, limit, offset]);
  ...
} catch (err) {
  console.error('[GET /staff] MySQL params error', { business_code, limit, offset }, err);
  throw err;
}


You’ll see immediately which variable is undefined or non-numeric.

6. Root cause checklist
Likely cause	Symptom	Fix
req.userContext missing	business_code undefined	ensure auth middleware attaches user context
buildPagination returned NaN	limit/offset invalid	add Number() cast defaults
Param order mismatch	using wrong order in array	match to SQL placeholder order
Strings for limit/offset	MySQL type error	cast to Number()
7. Permanent safe pattern

To bulletproof this endpoint, enforce defaults:

const business_code = req.userContext?.business_code || null;
const { limit, offset } = buildPagination(req);
if (!business_code) return res.status(400).json({ success:false, error:'Missing business_code' });

const [rows] = await db.execute(
  query,
  [business_code, Number(limit) || 100, Number(offset) || 0]
);

8. After the fix

Run again and the log should show:

[GET /staff] 📊 Total staff count: 17


and the frontend’s "Failed to fetch staff" will disappear.

So your immediate action:

Log business_code, limit, offset right before the db.execute() call.

You’ll see one of them undefined or not numeric.

Fix source variable or add Number() cast as shown.