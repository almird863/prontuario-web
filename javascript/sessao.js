// Carregado nas páginas que exigem login (início, pacientes, cadastro de paciente).
// Ordem dos scripts: axios, api.js, ui.js e, por último, este arquivo.
//
// Estas páginas começam escondidas (<body class="verificando">). Só aparecem depois que o
// servidor confirma o login. Sem login, o api.js manda para a tela de entrada (resposta 401).
//
// Atenção: isto só evita mostrar a página a quem não entrou. A proteção de verdade dos dados
// está no servidor, que recusa as chamadas sem login.

const nomePsicologo = document.getElementById("nome-psicologo")
const botaoSair = document.getElementById("botao-sair")

function verificarSessao() {
    return api
        .get("/auth/eu")
        .then((resposta) => {
            if (nomePsicologo) nomePsicologo.textContent = resposta.data.psicologo.nome
            document.body.classList.remove("verificando")
        })
        .catch((erro) => {
            if (erro.response?.status === 401) return // o api.js já está redirecionando para o login

            // Servidor fora do ar: mostra a página (não há dados nela) e avisa
            document.body.classList.remove("verificando")
            mostrarToast(mensagemDoErro(erro), "erro")
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