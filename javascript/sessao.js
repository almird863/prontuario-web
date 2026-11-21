// Carregado nas páginas que exigem login (início, pacientes, cadastro de paciente).
// Ordem dos scripts: axios, api.js, ui.js e, por último, este arquivo.
//
// Estas páginas começam escondidas (<body class="verificando">). Só aparecem depois que o
// servidor confirma o login. Se não confirmar, por qualquer motivo (sem login, servidor
// desligado, erro), a pessoa é mandada para a tela de entrada.
//
// Atenção: isto só evita mostrar a página a quem não entrou. A proteção de verdade dos dados
// está no servidor, que recusa as chamadas sem login.

const nomePsicologo = document.getElementById("nome-psicologo")
const botaoSair = document.getElementById("botao-sair")

function verificarSessao() {
    // timeout: se o servidor não responder em 5 segundos, conta como falha
    return api
        .get("/auth/eu", { timeout: 5000 })
        .then((resposta) => {
            if (nomePsicologo) nomePsicologo.textContent = resposta.data.psicologo.nome
            document.body.classList.remove("verificando")
        })
        .catch((erro) => {
            if (erro.response?.status === 401) return // o api.js já está redirecionando para o login

            // Qualquer outra falha (servidor desligado, sem internet, erro interno):
            // não deu para confirmar o login, então a pessoa volta para a tela de entrada.
            // A página continua escondida até lá. O aviso aparece na tela de login.
            toastNaProximaPagina(
                mensagemDoErro(erro, "Não foi possível confirmar o seu acesso."),
                "erro"
            )
            window.location.replace(caminhoLogin)
        })
}

verificarSessao()

// Voltar pelo botão do navegador pode mostrar uma página antiga guardada em memória,
// mesmo depois do logout. Nesse caso, confere a sessão de novo.
window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
        document.body.classList.add("verificando")
        verificarSessao()
    }
})

if (botaoSair) {
    botaoSair.addEventListener("click", async () => {
        try {
            await api.post("/auth/logout")
        } finally {
            window.location.replace(caminhoLogin)
        }
    })
}