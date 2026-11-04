// Política de privacidade (LGPD): página pública, aberta sem login.
import { Link } from 'react-router';
import { CONTROLADOR, CONTATO_PRIVACIDADE } from '../utils/privacidade';

// um bloco da página: título e conteúdo
function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-[#1a2332]">{titulo}</h2>
      <div className="text-gray-700 text-sm leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <main className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-10 space-y-6">
        <h1 className="text-2xl font-black text-[#1a2332]">Política de Privacidade</h1>
        <p className="text-gray-600 text-sm">
          Esta política explica como o Sistema de Gestão de Obras trata dados pessoais, conforme a Lei 13.709/2018 (LGPD).
          Última atualização: 04/11/2026.
        </p>

        <Secao titulo="Quem é o responsável">
          <p>
            O responsável pelos dados é a {CONTROLADOR}, empresa que usa o sistema. Para falar sobre seus dados, escreva para{' '}
            <a className="text-blue-700 underline" href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a>.
          </p>
        </Secao>

        <Secao titulo="Quais dados são guardados">
          <ul className="list-disc pl-5 space-y-1">
            <li>Dados do usuário: nome, e-mail, telefone e perfil de acesso (o cargo dentro do sistema).</li>
            <li>A senha é guardada só de forma cifrada (hash), nunca em texto.</li>
            <li>Registro do histórico de alterações: quem fez cada mudança nas obras, etapas, gastos e documentos, e quando.</li>
            <li>Documentos e comprovantes enviados às obras, que podem conter dados de terceiros.</li>
            <li>No navegador fica apenas o token de sessão (válido por 8 horas) e os dados básicos de quem entrou.</li>
          </ul>
        </Secao>

        <Secao titulo="Para que os dados são usados">
          <p>
            Os dados servem para permitir o acesso ao sistema, controlar quem pode fazer o quê e registrar a gestão das obras da empresa
            (LGPD, art. 7º, incisos V e IX). Não há uso para publicidade nem venda de dados.
          </p>
        </Secao>

        <Secao titulo="Com quem os dados são compartilhados">
          <ul className="list-disc pl-5 space-y-1">
            <li>Hospedagem: Microsoft Azure, em data center nos Estados Unidos, o que configura transferência internacional de dados (LGPD, art. 33).</li>
            <li>Análise por IA: o Google Gemini recebe apenas dados da obra (nome da obra, status, datas, valores e nomes de etapas). Os dados pessoais dos usuários não são enviados à IA.</li>
          </ul>
        </Secao>

        <Secao titulo="Por quanto tempo os dados ficam">
          <p>
            Os dados ficam enquanto a conta existir. O sistema mantém cópias de segurança diárias e guarda as 14 mais recentes;
            as mais antigas deixam de existir quando são substituídas.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>Você pode pedir, a qualquer momento (LGPD, art. 18):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>confirmação de que seus dados são tratados e acesso a eles;</li>
            <li>correção de dados incompletos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>portabilidade dos dados;</li>
            <li>informação sobre com quem os dados foram compartilhados;</li>
            <li>revogação do consentimento, quando ele for a base do tratamento.</li>
          </ul>
          <p>Para pedir, escreva para {CONTATO_PRIVACIDADE}. Um administrador do sistema atende o pedido.</p>
        </Secao>

        <Link to="/login" className="inline-block text-blue-700 underline text-sm">Voltar para o login</Link>
      </main>
    </div>
  );
}
