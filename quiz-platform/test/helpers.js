// 테스트용 가짜 Supabase 클라이언트: 호출된 쿼리 빌더 연산을 기록하고, 미리 지정한 행을 돌려준다.
//
// makeFake({ rows, rpc, user, insertReturns, insertErrors })
//   rows           : { table: [row, ...] }  select/update 결과의 원본 (eq/neq 필터 적용)
//   rpc            : { fnName: (args) => result }
//   user           : auth.getUser가 돌려줄 사용자. null이면 인증 실패. 기본은 관리자.
//   insertReturns  : { table: [row, ...] }  insert(...).select() 결과. 기본 [{ id: 'new-<table>' }]
//   insertErrors   : { table: { message } } 해당 테이블 insert를 실패시킴
// 반환: { client, log, updates, inserts }
export function makeFake({ rows = {}, rpc = {}, user, insertReturns = {}, insertErrors = {} } = {}) {
    const log = [];
    const updates = [];
    const inserts = [];
    const authUser = user === undefined ? { id: 'admin-id', email: 'agent@quizrank.com' } : user;

    function builder(table) {
        const ops = [];
        let mode = 'select';
        const q = {
            select(c) { ops.push(['select', c]); log.push(`${table}.select`); return q; },
            eq(c, v) { ops.push(['eq', c, v]); log.push(`${table}.eq:${c}=${v}`); return q; },
            neq(c, v) { ops.push(['neq', c, v]); log.push(`${table}.neq:${c}=${v}`); return q; },
            order(c) { log.push(`${table}.order:${c}`); return q; },
            limit(n) { log.push(`${table}.limit:${n}`); return q; },
            range(a, b) { log.push(`${table}.range:${a}-${b}`); return q; },
            update(payload) { mode = 'update'; updates.push({ table, payload }); log.push(`${table}.update`); return q; },
            insert(payload) { mode = 'insert'; inserts.push({ table, payload }); log.push(`${table}.insert`); return q; },
            single() { const r = result(); return Promise.resolve(r.data.length ? { data: r.data[0], error: null } : { data: null, error: { message: 'not found' } }); },
            maybeSingle() { return Promise.resolve({ data: null, error: null }); },
            then(res, rej) { return Promise.resolve(result()).then(res, rej); },
        };
        function result() {
            if (mode === 'insert') {
                if (insertErrors[table]) return { data: null, error: insertErrors[table] };
                return { data: insertReturns[table] || [{ id: `new-${table}` }], error: null };
            }
            let data = rows[table] || [];
            for (const [op, c, v] of ops) {
                if (op === 'eq') data = data.filter((r) => r[c] === v);
                if (op === 'neq') data = data.filter((r) => r[c] !== v);
            }
            return { data, error: null };
        }
        return q;
    }

    const client = {
        auth: {
            getUser: async () => (authUser ? { data: { user: authUser }, error: null } : { data: { user: null }, error: { message: 'invalid' } }),
            signInWithPassword: async () => ({ data: {}, error: null }),
        },
        from: (t) => builder(t),
        rpc(name, args) {
            log.push(`rpc:${name}`);
            const out = rpc[name] ? rpc[name](args) : null;
            return { maybeSingle: () => Promise.resolve({ data: out, error: null }), then: (res, rej) => Promise.resolve({ data: out, error: null }).then(res, rej) };
        },
    };
    return { log, updates, inserts, client };
}

export const req = (method, body) => new Request('https://api.test/x', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
