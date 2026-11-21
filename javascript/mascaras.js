// Deixa só os números de um texto
const apenasDigitos = (texto) => String(texto || "").replace(/\D/g, "")

// 12345678901 -> 123.456.789-01
function mascaraCpf(texto) {
    return apenasDigitos(texto)
        .slice(0, 11)
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
}

// 60123456 -> 60123-456
function mascaraCep(texto) {
    return apenasDigitos(texto)
        .slice(0, 8)
        .replace(/^(\d{5})(\d)/, "$1-$2")
}

// Celular (11 dígitos): (85) 99999-0000. Fixo (10 dígitos): (85) 3333-0000
function mascaraTelefone(texto) {
    const d = apenasDigitos(texto).slice(0, 11)

    if (d.length === 0) return ""
    if (d.length <= 2) return `(${d}`
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

const mascaras = {
    cpf: mascaraCpf,
    cep: mascaraCep,
    telefone: mascaraTelefone,
}

// Um único "ouvinte" na página inteira cuida de todos os campos com data-mascara
document.addEventListener("input", (evento) => {
    const tipo = evento.target.dataset?.mascara
    if (!tipo || !mascaras[tipo]) return

    evento.target.value = mascaras[tipo](evento.target.value)
})

// Formata os valores que já estão nos campos (usado ao carregar um paciente para editar,
// porque preencher um campo por código não dispara o evento "input")
function aplicarMascaras() {
    document.querySelectorAll("[data-mascara]").forEach((campo) => {
        const formatar = mascaras[campo.dataset.mascara]
        if (formatar) campo.value = formatar(campo.value)
    })
}