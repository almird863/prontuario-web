// Avisos rápidos (toasts). Carregue este arquivo DEPOIS do api.js e ANTES do script da página.
//
// Uso:
//   mostrarToast("Paciente salvo!", "sucesso")
//   mostrarToast("Algo deu errado.", "erro")
//   toastNaProximaPagina("Alterações salvas!", "sucesso")   // aparece depois de trocar de página
//
// Tipos: "sucesso" (verde), "erro" (vermelho) e "info" (escuro, é o padrão).

function obterAreaDeAvisos() {
    let area = document.getElementById("avisos")

    // Páginas sem a área no HTML (como login e cadastro) ganham uma automaticamente
    if (!area) {
        area = document.createElement("div")
        area.id = "avisos"
        area.className = "avisos"
        area.setAttribute("aria-live", "polite")
        document.body.appendChild(area)
    }

    return area
}

function mostrarToast(mensagem, tipo = "info") {
    const toast = document.createElement("div")
    toast.className = `toast toast--${tipo}`
    toast.textContent = mensagem // textContent: texto nunca vira código na página
    toast.setAttribute("role", tipo === "erro" ? "alert" : "status")

    // Clicar no aviso fecha ele
    toast.addEventListener("click", () => toast.remove())

    obterAreaDeAvisos().appendChild(toast)

    // Erros ficam um pouco mais na tela, para dar tempo de ler
    setTimeout(() => toast.remove(), tipo === "erro" ? 6000 : 4000)
}

// Para avisos que precisam sobreviver a um redirecionamento (salvar e voltar para a lista).
// A mensagem fica guardada só até a próxima página mostrá-la.
function toastNaProximaPagina(mensagem, tipo = "info") {
    sessionStorage.setItem("toastPendente", JSON.stringify({ mensagem, tipo }))
}

// Transforma o erro do Axios numa frase para mostrar ao usuário
function mensagemDoErro(erro, padrao = "Não foi possível concluir a ação.") {
    if (erro.response) return erro.response.data?.mensagem || padrao
    return "Não consegui falar com o servidor. Ele está rodando?"
}

// Ao abrir a página, mostra o aviso deixado pela página anterior (se houver)
const toastGuardado = sessionStorage.getItem("toastPendente")

if (toastGuardado) {
    sessionStorage.removeItem("toastPendente")

    try {
        const { mensagem, tipo } = JSON.parse(toastGuardado)
        mostrarToast(mensagem, tipo)
    } catch {
        // aviso corrompido: ignora
    }
}