// Id do paciente vem da URL: prontuario.html?id=123
const idPaciente = new URLSearchParams(window.location.search).get("id")

const tituloPaciente = document.getElementById("paciente-nome")
const resumoPaciente = document.getElementById("paciente-resumo")
const seloStatus = document.getElementById("paciente-status")
const linkEditar = document.getElementById("link-editar")
const linkPdf = document.getElementById("link-pdf")
const cabecalhoPaciente = document.querySelector(".paciente-cabecalho")

const abas = document.querySelectorAll('[role="tab"]')

// ---------------------------------------------------------------------------
// Funções de apoio (parecidas com as do pacientes.js; juntamos depois)
// ---------------------------------------------------------------------------
function idadeEmAnos(dataIso) {
    if (!dataIso) return null

    const nascimento = new Date(dataIso)
    const hoje = new Date()

    let idade = hoje.getFullYear() - nascimento.getUTCFullYear()

    const jaFezAniversario =
        hoje.getMonth() > nascimento.getUTCMonth() ||
        (hoje.getMonth() === nascimento.getUTCMonth() && hoje.getDate() >= nascimento.getUTCDate())

    if (!jaFezAniversario) idade--
    return idade
}

function formatarData(dataIso) {
    if (!dataIso) return ""
    return new Date(dataIso).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

// juntar("Ana", "", "(85) 9") -> "Ana, (85) 9"
const juntar = (...partes) => partes.filter(Boolean).join(", ")

function textoPessoa(p = {}) {
    const nome = p.nome && p.parentesco ? `${p.nome} (${p.parentesco})` : p.nome || ""
    return juntar(nome, p.telefone)
}

const rotulosStatus = { ativo: "Ativo", pausa: "Em pausa", alta: "Alta", arquivado: "Arquivado" }

// ---------------------------------------------------------------------------
// Abas
// ---------------------------------------------------------------------------
function selecionarAba(aba, { moverFoco = false } = {}) {
    abas.forEach((outra) => {
        const ativa = outra === aba
        outra.setAttribute("aria-selected", String(ativa))
        outra.tabIndex = ativa ? 0 : -1
        document.getElementById(outra.getAttribute("aria-controls")).hidden = !ativa
    })

    if (moverFoco) aba.focus()

    // Guarda a aba na URL (#evolucoes): ao recarregar, a página volta na mesma aba
    history.replaceState(null, "", `#${aba.dataset.aba}`)
}

abas.forEach((aba) => aba.addEventListener("click", () => selecionarAba(aba)))

// Setas do teclado trocam de aba (padrão de acessibilidade para abas)
document.querySelector('[role="tablist"]').addEventListener("keydown", (evento) => {
    const lista = [...abas]
    const atual = lista.findIndex((aba) => aba.getAttribute("aria-selected") === "true")

    let novo = null
    if (evento.key === "ArrowRight") novo = (atual + 1) % lista.length
    if (evento.key === "ArrowLeft") novo = (atual - 1 + lista.length) % lista.length
    if (evento.key === "Home") novo = 0
    if (evento.key === "End") novo = lista.length - 1

    if (novo !== null) {
        evento.preventDefault()
        selecionarAba(lista[novo], { moverFoco: true })
    }
})

// Abre na aba indicada pela URL, se houver
const abaDaUrl = [...abas].find((aba) => aba.dataset.aba === window.location.hash.slice(1))
if (abaDaUrl) selecionarAba(abaDaUrl)

// ---------------------------------------------------------------------------
// Cabeçalho do paciente
// ---------------------------------------------------------------------------
function textoDoCampo(campo, valor) {
    if (campo === "dataInicio") return formatarData(valor)
    if (campo === "emergencia" || campo === "responsavel") return textoPessoa(valor)
    return typeof valor === "string" ? valor : ""
}

// Devolve true se o paciente foi carregado, false se deu erro (e a pessoa foi redirecionada)
async function carregarPaciente() {
    if (!idPaciente) {
        toastNaProximaPagina("Escolha um paciente para abrir o prontuário.", "erro")
        window.location.replace("pacientes.html")
        return false
    }

    try {
        const resposta = await api.get(`/pacientes/${encodeURIComponent(idPaciente)}`)
        const paciente = resposta.data

        document.title = `Prontuário – ${paciente.nome}`
        tituloPaciente.textContent = paciente.nome

        const idade = idadeEmAnos(paciente.dataNascimento)
        resumoPaciente.textContent = [
            idade !== null ? `${idade} anos` : "",
            paciente.nomeSocial ? `Nome social: ${paciente.nomeSocial}` : "",
        ]
            .filter(Boolean)
            .join(" · ")

        const status = paciente.status || "ativo"
        seloStatus.textContent = rotulosStatus[status] || status
        seloStatus.className = `selo selo--${status}`

        linkEditar.href = `anamnese.html?id=${encodeURIComponent(paciente._id)}`
        linkPdf.href = `impressao.html?id=${encodeURIComponent(paciente._id)}`

        // Preenche todos os campos do cabeçalho; os vazios aparecem como "Não informado"
        cabecalhoPaciente.querySelectorAll("[data-campo]").forEach((elemento) => {
            const campo = elemento.dataset.campo
            elemento.textContent = textoDoCampo(campo, paciente[campo])
        })

        // "Responsável legal" só aparece para menores de idade
        cabecalhoPaciente.querySelectorAll("[data-somente-menor]").forEach((elemento) => {
            elemento.hidden = !(idade !== null && idade < 18)
        })

        return true
    } catch (erro) {
        if (erro.response?.status === 401) return false // o api.js redireciona para o login

        toastNaProximaPagina(
            erro.response?.status === 404 ? "Paciente não encontrado." : mensagemDoErro(erro),
            "erro"
        )
        window.location.replace("pacientes.html")
        return false
    }
}

// ---------------------------------------------------------------------------
// Resumo clínico
// ---------------------------------------------------------------------------
const formResumo = document.getElementById("form-resumo")
const botaoSalvarResumo = document.getElementById("botao-salvar-resumo")
const statusResumo = document.getElementById("status-resumo")

const CAMPOS_RESUMO = ["demandaInicial", "historicoRelevante", "hipoteseFormulacao", "observacoes"]
const enderecoProntuario = () => `/pacientes/${encodeURIComponent(idPaciente)}/prontuario`

let resumoAlterado = false // true quando há texto digitado que ainda não foi salvo

function horaAgora() {
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

async function carregarResumo() {
    try {
        const resposta = await api.get(enderecoProntuario())

        CAMPOS_RESUMO.forEach((campo) => {
            formResumo.elements[campo].value = resposta.data[campo] || ""
        })

        resumoAlterado = false
        statusResumo.textContent = ""
    } catch (erro) {
        if (erro.response?.status === 401) return
        mostrarToast(mensagemDoErro(erro, "Não foi possível carregar o resumo clínico."), "erro")
    }
}

// Qualquer digitação marca o resumo como "não salvo"
formResumo.addEventListener("input", () => {
    resumoAlterado = true
    statusResumo.textContent = "Alterações não salvas"
})

formResumo.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    const dados = {}
    CAMPOS_RESUMO.forEach((campo) => {
        dados[campo] = formResumo.elements[campo].value
    })

    botaoSalvarResumo.disabled = true

    try {
        await api.put(enderecoProntuario(), dados)

        resumoAlterado = false
        statusResumo.textContent = `Salvo às ${horaAgora()}`
        mostrarToast("Resumo clínico salvo!", "sucesso")
    } catch (erro) {
        mostrarToast(mensagemDoErro(erro, "Não foi possível salvar o resumo."), "erro")
    } finally {
        botaoSalvarResumo.disabled = false
    }
})

// Aviso do navegador ao fechar ou sair da página com texto não salvo
window.addEventListener("beforeunload", (evento) => {
    if (resumoAlterado) {
        evento.preventDefault()
        evento.returnValue = ""
    }
})

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
carregarPaciente().then((carregou) => {
    if (carregou) {
        carregarResumo()
        carregarEvolucoes() // definida no evolucoes.js
    }
})