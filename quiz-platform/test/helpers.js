// 테스트용 가짜 Supabase 클라이언트: 호출된 쿼리 빌더 연산을 기록하고, 미리 지정한 행을 돌려준다.
export function makeFake({ rows = {}, rpc = {} } = {}) {
    const log = [];
    function builder(table) {
        const ops = [];
        const q = {
            select(c) { ops.push(['select', c]); log.push(`${table}.select`); return q; },
            eq(c, v) { ops.push(['eq', c, v]); log.push(`${table}.eq:${c}=${v}`); return q; },
            neq(c, v) { ops.push(['neq', c, v]); log.push(`${table}.neq:${c}=${v}`); return q; },
            order(c) { log.push(`${table}.order:${c}`); return q; },
            limit(n) { log.push(`${table}.limit:${n}`); return q; },
            range(a, b) { log.push(`${table}.range:${a}-${b}`); return q; },
            update() { log.push(`${table}.update`); return q; },
            insert() { log.push(`${table}.insert`); return q; },
            single() { const r = result(); return Promise.resolve(r.data.length ? { data: r.data[0], error: null } : { data: null, error: { message: 'not found' } }); },
            maybeSingle() { return Promise.resolve({ data: null, error: null }); },
            then(res, rej) { return Promise.resolve(result()).then(res, rej); },
        };
        function result() {
            let data = rows[table] || [];
            for (const [op, c, v] of ops) {
                if (op === 'eq') data = data.filter((r) => r[c] === v);
                if (op === 'neq') data = data.filter((r) => r[c] !== v);
            }
            return { data, error: null };
        }
        return q;
    }
    return {
        log,
        client: {
            from: (t) => builder(t),
            rpc(name, args) {
                log.push(`rpc:${name}`);
                const out = rpc[name] ? rpc[name](args) : null;
                return { maybeSingle: () => Promise.resolve({ data: out, error: null }), then: (res, rej) => Promise.resolve({ data: out, error: null }).then(res, rej) };
            },
        },
    };
}

export const req = (method, body) => new Request('https://api.test/x', { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
