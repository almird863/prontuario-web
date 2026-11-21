const corpo = document.getElementById("corpo-pacientes")
const modelo = document.getElementById("modelo-linha")
const vazio = document.getElementById("vazio-pacientes")
const contador = document. getElementById("contador")

function idadeEmAnos(dataIso) {
    if (!dataIso) return null

    const nascimento = new Date(dataIso)
    const hoje = new Date()

    let idade = hoje.getFullYear() - nascimento.getUTCFullYear()

    const jaFezAniversario =
        hoje.getMonth() > nascimento.getUTCMonth() ||
        (hoje.getMonth() === nascimento.getUTCMonth() &&
            hoje.getDate() >= nascimento.getUTCDate())

    if (!jaFezAniversario) idade--
    return idade
}

function calcularIdade(dataIso) {
    const idade = idadeEmAnos(dataIso)
    return idade === null ? "—" : `${idade} anos`
}

function montarLinha(paciente) {

    const linha = modelo.content.cloneNode(true)

    linha.querySelector("tr").dataset.id = paciente._id
    linha.querySelector(".link-nome").textContent = paciente.nome
    linha.querySelector("[data-col='idade']").textContent = calcularIdade(paciente.dataNascimento)
    linha.querySelector("[data-col='telefone']").textContent = paciente.telefone || "-"

    const selo = linha.querySelector("[data-col='status']")
    selo.textContent = paciente.status || "ativo"
    selo.classList.add(`selo--${paciente.status || "ativo"}`)

    linha.querySelector("[data-col='ultimaSessao']").textContent = "-"

    return linha
}

const campoBusca = document.getElementById("filtro-busca")
const filtroStatus = document.getElementById("filtro-status")
const filtroOrdem = document.getElementById("filtro-ordem")
const formFiltros = document.getElementById("form-filtros")

let buscaEmAndamento = null

async function carregarPacientes() {
    // Se ainda há uma busca antiga em andamento, cancela: só vale a mais recente
    if (buscaEmAndamento) buscaEmAndamento.abort()
    buscaEmAndamento = new AbortController()

    try {
        const resposta = await api.get("/pacientes", {
            params: {
                busca: campoBusca.value.trim(),
                status: filtroStatus.value,
                ordem: filtroOrdem.value,
            },
            signal: buscaEmAndamento.signal,
        })
        const pacientes = resposta.data

        corpo.replaceChildren()

        vazio.hidden = pacientes.length > 0
        contador.textContent =
            pacientes.length === 1 ? "1 paciente" : `${pacientes.length} pacientes`

        pacientes.forEach((paciente) => {
            corpo.appendChild(montarLinha(paciente))
        })
    } catch (erro) {
        if (axios.isCancel(erro)) return // foi cancelada por uma busca mais nova

        console.error("Erro ao carregar pacientes:", erro)
        contador.textContent = "Não foi possível carregar os pacientes. O servidor está rodando?"
    }
}

// Apertar Enter no campo de busca não pode recarregar a página
formFiltros.addEventListener("submit", (evento) => evento.preventDefault())

// Busca enquanto digita, esperando 300 ms de pausa (para não consultar a cada letra)
let temporizador
campoBusca.addEventListener("input", () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(carregarPacientes, 300)
})

// Os selects filtram na hora
filtroStatus.addEventListener("change", carregarPacientes)
filtroOrdem.addEventListener("change", carregarPacientes)

const dialog = document.getElementById("dialog-paciente")
const dialogTitulo = document.getElementById("dialog-titulo")
const dialogSubtitulo = document.getElementById("dialog-subtitulo")
const linkProntuario = document.getElementById("dialog-abrir-prontuario")
const linkEditar = document.getElementById("dialog-editar")

function formatarData(dataIso) {
    if (!dataIso) return ""
    return new Date(dataIso).toLocaleDateString("pt-BR", { timeZone: "UTC" })
}

const rotulos = {
    feminino: "Feminino",
    masculino: "Masculino",
    "nao-binario": "Não binário",
    transgenero: "Transgênero",
    outro: "Outro",
    "nao-informado": "Prefere não informar",
    solteiro: "Solteiro(a)",
    casado: "Casado(a) / União estável",
    separado: "Separado(a) / Divorciado(a)",
    viuvo: "Viúvo(a)",
}

// Junta só as partes que existem: juntar("Rua A", "", "12") -> "Rua A, 12"
function juntar(...partes) {
    return partes.filter(Boolean).join(", ")
}

function textoEndereco(e = {}) {
    const rua = juntar(e.logradouro, e.numero, e.complemento)
    const cidade = [e.cidade, e.uf].filter(Boolean).join("/")
    return juntar(rua, e.bairro, cidade, e.cep ? `CEP ${e.cep}` : "")
}

// Serve para o responsável e para o contato de emergência
function textoPessoa(p = {}) {
    const nome = p.nome && p.parentesco ? `${p.nome} (${p.parentesco})` : p.nome || ""
    return juntar(nome, p.telefone)
}

function textoDoCampo(campo, valor) {
    if (campo === "dataNascimento" || campo === "dataInicio") return formatarData(valor)
    if (campo === "endereco") return textoEndereco(valor)
    if (campo === "emergencia" || campo === "responsavel") return textoPessoa(valor)
    if (campo === "genero" || campo === "estadoCivil") return rotulos[valor] || ""
    if (typeof valor === "string") return valor
    return ""
}

async function abrirDetalhes(id) {
    try {
        const resposta = await api.get(`/pacientes/${id}`)
        const paciente = resposta.data

        dialogTitulo.textContent = paciente.nome
        const idade = idadeEmAnos(paciente.dataNascimento)

        dialogSubtitulo.textContent = [
            idade !== null ? `${idade} anos` : "",
            paciente.status || "",
        ].filter(Boolean).join(" · ")

// A linha "Responsável legal" só aparece para menores de idade
dialog.querySelectorAll("[data-somente-menor]").forEach((elemento) => {
    elemento.hidden = !(idade !== null && idade < 18)
})
        // Preenche TODOS os campos, inclusive os vazios, para não sobrar
        // dado do paciente aberto antes
        dialog.querySelectorAll("[data-campo]").forEach((elemento) => {
            const campo = elemento.dataset.campo
            elemento.textContent = textoDoCampo(campo, paciente[campo])
        })

        linkProntuario.href = `prontuario.html?id=${paciente._id}`
        linkEditar.href = `anamnese.html?id=${paciente._id}`

        dialog.showModal()
    } catch (erro) {
        console.error("Erro ao abrir detalhes:", erro)
        mostrarToast("Não foi possível abrir os detalhes do paciente.", "erro")
    }
}

// Um único "ouvinte" no tbody atende o clique de todas as linhas
corpo.addEventListener("click", (evento) => {
    const gatilho = evento.target.closest("[data-abrir-dialog]")
    if (!gatilho) return

    evento.preventDefault() // impede o link href="#" de subir a página

    const id = gatilho.closest("tr").dataset.id
    abrirDetalhes(id)
})

// Fechar: botão "Fechar" ou clique fora da janela (a tecla Esc já fecha sozinha)
dialog.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-fechar-dialog]") || evento.target === dialog) {
        dialog.close()
    }
})

carregarPacientes()
