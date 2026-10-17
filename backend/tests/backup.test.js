// Backup do banco: scripts que exportam, baixam e restauram os dados.
// Os testes usam "docker", "ssh" e "scp" de mentira (stubs), então não tocam em banco nenhum.
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");

const raiz = path.join(__dirname, "..", "..");
const script = (nome) => path.join(raiz, "scripts", nome);
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

let tmp, bin, log;

// cria um comando falso que anota os argumentos recebidos e responde conforme STUB_MODE
function criarStub(nome, corpo) {
  const arquivo = path.join(bin, nome);
  fs.writeFileSync(arquivo, `#!/bin/sh\necho "${nome} $*" >> "$STUB_LOG"\n${corpo}\n`, { mode: 0o755 });
}

function rodar(nomeScript, args = [], extra = {}) {
  return spawnSync("bash", [script(nomeScript), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_LOG: log, ...extra },
  });
}

const anotado = () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "");

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "backup-"));
  bin = path.join(tmp, "bin");
  fs.mkdirSync(bin);
  log = path.join(tmp, "chamadas.log");
  criarStub("docker", `
case "$*" in
  *pg_dump*)
    [ "$STUB_MODE" = "falha" ] && exit 1
    [ "$STUB_MODE" = "vazio" ] && exit 0
    echo "CREATE TABLE obras (id uuid);"; echo "INSERT INTO obras VALUES ('x');" ;;
  *information_schema*) echo " 7" ;;
  *) cat > /dev/null ;;
esac`);
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe("backup-banco.sh", () => {
  it("grava um arquivo obras-DATA.sql.gz com o conteúdo do banco", () => {
    const pasta = path.join(tmp, "backups");
    const r = rodar("backup-banco.sh", [], { BACKUP_DIR: pasta });
    assert.strictEqual(r.status, 0, r.stderr);
    const arquivos = fs.readdirSync(pasta).filter((f) => /^obras-\d{8}-\d{6}\.sql\.gz$/.test(f));
    assert.strictEqual(arquivos.length, 1);
    const sql = zlib.gunzipSync(fs.readFileSync(path.join(pasta, arquivos[0]))).toString();
    assert.match(sql, /CREATE TABLE obras/);
  });

  it("exporta com --clean para o arquivo poder ser restaurado sobre um banco já criado", () => {
    rodar("backup-banco.sh", [], { BACKUP_DIR: path.join(tmp, "b") });
    assert.match(anotado(), /pg_dump.*--clean.*--if-exists/);
  });

  it("o arquivo de backup só pode ser lido pelo dono (permissão 600)", () => {
    const pasta = path.join(tmp, "b");
    rodar("backup-banco.sh", [], { BACKUP_DIR: pasta });
    const arquivo = fs.readdirSync(pasta).find((f) => f.endsWith(".sql.gz"));
    assert.strictEqual(fs.statSync(path.join(pasta, arquivo)).mode & 0o777, 0o600);
  });

  it("mantém só os N backups mais novos e apaga os mais antigos", () => {
    const pasta = path.join(tmp, "b");
    fs.mkdirSync(pasta);
    for (const dia of ["20200101", "20200102", "20200103", "20200104", "20200105"]) {
      fs.writeFileSync(path.join(pasta, `obras-${dia}-000000.sql.gz`), "x");
    }
    const r = rodar("backup-banco.sh", [], { BACKUP_DIR: pasta, KEEP: "3" });
    assert.strictEqual(r.status, 0, r.stderr);
    const sobrou = fs.readdirSync(pasta).filter((f) => f.endsWith(".sql.gz")).sort();
    assert.strictEqual(sobrou.length, 3);
    assert.ok(sobrou.includes("obras-20200105-000000.sql.gz"));
    assert.ok(!sobrou.includes("obras-20200101-000000.sql.gz"));
  });

  it("se o dump falhar, sai com erro, não deixa arquivo parcial e não apaga os backups antigos", () => {
    const pasta = path.join(tmp, "b");
    fs.mkdirSync(pasta);
    fs.writeFileSync(path.join(pasta, "obras-20200101-000000.sql.gz"), "x");
    const r = rodar("backup-banco.sh", [], { BACKUP_DIR: pasta, KEEP: "1", STUB_MODE: "falha" });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /ERRO/, "o script precisa explicar a falha");
    assert.match(anotado(), /pg_dump/, "o script precisa ter tentado exportar");
    assert.deepStrictEqual(fs.readdirSync(pasta), ["obras-20200101-000000.sql.gz"]);
  });

  it("um dump vazio é tratado como falha", () => {
    const pasta = path.join(tmp, "b");
    const r = rodar("backup-banco.sh", [], { BACKUP_DIR: pasta, STUB_MODE: "vazio" });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /ERRO/, "o script precisa explicar a falha");
    const arquivos = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith(".sql.gz")) : [];
    assert.strictEqual(arquivos.length, 0);
  });

  it("não guarda nem pede senha: usa as variáveis do próprio container do banco", () => {
    const fonte = fs.readFileSync(script("backup-banco.sh"), "utf8");
    assert.match(fonte, /\$POSTGRES_USER/);
    assert.doesNotMatch(fonte, /PASSWORD|PGPASSWORD/);
  });
});

describe("restaurar-backup.sh", () => {
  const backup = () => {
    const arquivo = path.join(tmp, "obras-20260101-000000.sql.gz");
    fs.writeFileSync(arquivo, zlib.gzipSync("CREATE TABLE obras (id uuid);\n"));
    return arquivo;
  };

  it("sem arquivo, mostra como usar e sai com erro", () => {
    const r = rodar("restaurar-backup.sh");
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stdout + r.stderr, /Uso:/);
  });

  it("arquivo que não existe é erro", () => {
    const r = rodar("restaurar-backup.sh", [path.join(tmp, "nao-existe.sql.gz")]);
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /ERRO/, "o script precisa explicar a falha");
    assert.strictEqual(anotado(), "", "não pode chamar o banco se o arquivo não existe");
  });

  it("por padrão restaura num banco de teste e nunca encosta no banco de verdade", () => {
    const r = rodar("restaurar-backup.sh", [backup()]);
    assert.strictEqual(r.status, 0, r.stderr);
    const chamadas = anotado();
    assert.match(chamadas, /obras_restore_test/);
    assert.doesNotMatch(chamadas, /\$POSTGRES_DB/, "o banco de produção não pode ser usado no teste");
    assert.match(r.stdout, /tabelas restauradas: 7/);
  });

  it("restaura dentro de uma transação única: se algo falhar, nada fica pela metade", () => {
    rodar("restaurar-backup.sh", [backup()]);
    assert.match(anotado(), /--single-transaction/);
    assert.match(anotado(), /ON_ERROR_STOP=1/);
  });

  it("restaurar no banco de verdade (--producao) exige digitar RESTAURAR", () => {
    const sem = spawnSync("bash", [script("restaurar-backup.sh"), "--producao", backup()], {
      encoding: "utf8",
      input: "nao\n",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_LOG: log },
    });
    assert.notStrictEqual(sem.status, 0);
    assert.doesNotMatch(anotado(), /\$POSTGRES_DB/);

    const com = spawnSync("bash", [script("restaurar-backup.sh"), "--producao", backup()], {
      encoding: "utf8",
      input: "RESTAURAR\n",
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_LOG: log },
    });
    assert.strictEqual(com.status, 0, com.stderr);
    assert.match(anotado(), /\$POSTGRES_DB/);
  });
});

describe("baixar-backup.sh (roda no Mac)", () => {
  beforeEach(() => {
    criarStub("ssh", `[ "$STUB_MODE" = "vazio" ] && exit 0\necho "obras-20260101-030000.sql.gz"`);
    criarStub("scp", "exit 0");
  });

  it("copia o backup mais novo da VM para a pasta indicada, usando a chave SSH informada", () => {
    const destino = path.join(tmp, "meus-backups");
    const r = rodar("baixar-backup.sh", [], {
      VM_HOST: "azureuser@exemplo.test",
      SSH_KEY: "/chave/falsa.pem",
      DEST: destino,
    });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.ok(fs.existsSync(destino));
    const chamadas = anotado();
    assert.match(chamadas, /ssh .*-i \/chave\/falsa\.pem .*azureuser@exemplo\.test/);
    assert.match(chamadas, /scp .*-i \/chave\/falsa\.pem .*azureuser@exemplo\.test:.*obras-20260101-030000\.sql\.gz/);
  });

  it("se a VM não tem nenhum backup, avisa e sai com erro", () => {
    const r = rodar("baixar-backup.sh", [], { DEST: path.join(tmp, "d"), STUB_MODE: "vazio" });
    assert.notStrictEqual(r.status, 0);
    assert.match(r.stderr, /ERRO/, "o script precisa explicar a falha");
    assert.match(anotado(), /ssh /, "o script precisa ter consultado a VM");
    assert.doesNotMatch(anotado(), /scp /);
  });
});

describe("backup (organização do projeto)", () => {
  it("a pasta backups/ não vai para o GitHub (tem dados reais e hashes de senha)", () => {
    assert.match(ler(".gitignore"), /^backups\/$/m);
  });

  it("o README explica como fazer, agendar, baixar e restaurar o backup", () => {
    const readme = ler("README.md");
    assert.match(readme, /## Backup do banco/);
    assert.match(readme, /backup-banco\.sh/);
    assert.match(readme, /baixar-backup\.sh/);
    assert.match(readme, /restaurar-backup\.sh/);
    assert.match(readme, /crontab/);
  });
});
