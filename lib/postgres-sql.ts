export const POSTGRES_SCHEMA = "jodo_demo";

export function postgresConnection(connectionString: string) {
  const ca = process.env.DATABASE_CA_CERT;
  if (!ca) return { connectionString };

  const uri = new URL(connectionString);
  // pg lets SSL options in the URI override the supplied trust configuration.
  uri.searchParams.delete("sslmode");
  uri.searchParams.delete("sslrootcert");
  return { connectionString: uri.href, ssl: { ca, rejectUnauthorized: true } };
}

/** Translate the app's SQL without touching quoted text or comments. */
export function postgresSql(sql: string) {
  let index = 0;
  const tokens = /'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\r\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][A-Za-z_0-9]*|\?/g;
  return sql.replace(tokens, (token) => {
    if (token === "?") return `$${++index}`;
    if (!/^[A-Za-z_]/.test(token)) return token;
    return token.toLowerCase() === "user" || /[a-z][A-Z]/.test(token) ? `"${token}"` : token;
  });
}
