const form = document.getElementById("form-cadastro")
const botao = document.getElementById("botao-cadastrar")
const erroGeral = document.getElementById("erro-geral")

function mostrarErro(mensagem) {
    erroGeral.textContent = mensagem
    erroGeral.hidden = false
}

form.addEventListener("submit", async (evento) => {
    evento.preventDefault()
    erroGeral.hidden = true

    if (form.elements.senha.value !== form.elements.confirmarSenha.value) {
        mostrarErro("As senhas não coincidem.")
        return
    }

    botao.disabled = true

    try {
        await api.post("/auth/cadastro", {
            nome: form.elements.nome.value.trim(),
            crp: form.elements.crp.value.trim(),
            email: form.elements.email.value.trim(),
            senha: form.elements.senha.value,
        })
        toastNaProximaPagina("Conta criada! Agora é só entrar.", "sucesso")
        window.location.href = "login.html"
    } catch (erro) {
        mostrarErro(erro.response?.data?.mensagem || "Não consegui falar com o servidor. Ele está rodando?")
    } finally {
        botao.disabled = false
    }
})