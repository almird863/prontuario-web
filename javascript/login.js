const form = document.getElementById("form-login")
const botao = document.getElementById("botao-entrar")
const erroGeral = document.getElementById("erro-geral")
const campoSenha = document.getElementById("senha")
const botaoMostrar = document.getElementById("alternar-senha")

// Quem já está logado não precisa ver a tela de login.
// "replace" troca a página no histórico, então o botão Voltar não traz o login de volta.
api.get("/auth/eu")
    .then(() => window.location.replace("../index.html"))
    .catch(() => {}) // não está logado (ou o servidor está fora do ar): fica no login

function mostrarErro(mensagem) {
    erroGeral.textContent = mensagem
    erroGeral.hidden = false
}

// Botão "Mostrar / Ocultar" da senha
botaoMostrar.addEventListener("click", () => {
    const estaMostrando = campoSenha.type === "text"
    campoSenha.type = estaMostrando ? "password" : "text"
    botaoMostrar.textContent = estaMostrando ? "Mostrar" : "Ocultar"
    botaoMostrar.setAttribute("aria-pressed", String(!estaMostrando))
})

form.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    erroGeral.hidden = true

    const email = form.elements.email.value.trim()
    const senha = form.elements.senha.value

    if (!email || !senha) {
        mostrarErro("Informe o e-mail e a senha.")
        return
    }

    botao.disabled = true
    botao.textContent = "Entrando..."

    try {
        await api.post("/auth/login", { email, senha })
        window.location.replace("../index.html")
    } catch (erro) {
        mostrarErro(mensagemDoErro(erro, "Não foi possível entrar."))
        botao.disabled = false
        botao.textContent = "Entrar"
    }
})