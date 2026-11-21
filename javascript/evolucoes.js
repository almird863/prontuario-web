// Aba Evoluções: linha do tempo das sessões e editor de rascunho com salvamento automático.
// Depende do prontuario.js (idPaciente, horaAgora), do api.js e do ui.js.

const enderecoEvolucoes = () => `/pacientes/${encodeURIComponent(idPaciente)}/evolucoes`

// Lista
const areaLista = document.getElementById("area-lista")
const listaEvolucoes = document.getElementById("lista-evolucoes")
const vazioEvolucoes = document.getElementById("vazio-evolucoes")
const contadorEvolucoes = document.getElementById("contador-evolucoes")
const modeloEvolucao = document.getElementById("modelo-evolucao")
const botaoNovaEvolucao = document.getElementById("botao-nova-evolucao")

// Editor
const formEvolucao = document.getElementById("form-evolucao")
const tituloEditor = document.getElementById("titulo-editor")
const statusEvolucao = document.getElementById("status-evolucao")
const botaoVoltarLista = document.getElementById("botao-voltar-lista")
const botaoDescartar = document.getElementById("botao-descartar")
const dialogDescartar = document.getElementById("dialog-descartar")

const rotulosModalidade = { presencial: "Presencial", online: "Online", hibrido: "Híbrido" }
const rotulosPresenca = { compareceu: "Compareceu", faltou: "Faltou", desmarcou: "Desmarcou" }

let evolucoesPorId = new Map() // evoluções da última busca, para abrir o editor sem nova chamada

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------
// "21 de novembro de 2026 às 14:30" (na hora local de quem está vendo)
function formatarDataHora(dataIso) {
    return new Date(dataIso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
}

// Date -> "2026-11-21T14:30": hora LOCAL, no formato do campo datetime-local
function paraInputDataHora(data) {
    const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------
function montarEvolucao(evolucao) {
    const fragmento = modeloEvolucao.content.cloneNode(true)
    const artigo = fragmento.querySelector(".evolucao")
    const rascunho = evolucao.status === "rascunho"

    artigo.dataset.id = evolucao._id
    artigo.classList.toggle("evolucao--rascunho", rascunho)

    fragmento.querySelector(".evolucao__data").textContent = formatarDataHora(evolucao.dataSessao)

    fragmento.querySelector(".evolucao__meta").textContent = [
        evolucao.duracaoMin ? `${evolucao.duracaoMin} min` : "",
        rotulosModalidade[evolucao.modalidade] || "",
        evolucao.presenca && evolucao.presenca !== "compareceu" ? rotulosPresenca[evolucao.presenca] : "",
        !rascunho && evolucao.finalizadaEm ? `Finalizada em ${formatarDataHora(evolucao.finalizadaEm)}` : "",
    ]
        .filter(Boolean)
        .join(" · ")

    const selo = fragmento.querySelector(".evolucao__status")
    selo.textContent = rascunho ? "Rascunho" : "Finalizada"
    selo.classList.add(rascunho ? "selo--pausa" : "selo--ativo")

    // Rascunho pode ser editado; evolução finalizada só recebe adendos
    if (rascunho) {
        fragmento.querySelector('[data-acao="adendo"]').remove()
    } else {
        fragmento.querySelector('[data-acao="editar"]').remove()
    }

    // Seções de texto: as vazias não aparecem
    let temTexto = false
    fragmento.querySelectorAll("[data-secao]").forEach((secao) => {
        const texto = evolucao[secao.dataset.secao]

        if (texto) {
            secao.querySelector(".evolucao__corpo").textContent = texto // textContent: nunca vira código
            temTexto = true
        } else {
            secao.remove()
        }
    })
    if (!temTexto) fragmento.querySelector(".evolucao__vazio").hidden = false

    // Adendos acrescentados depois da finalização
    const blocoAdendos = fragmento.querySelector(".evolucao__adendos")
    const adendos = evolucao.adendos || []

    if (adendos.length === 0) {
        blocoAdendos.remove()
    } else {
        const lista = blocoAdendos.querySelector("ul")

        adendos.forEach((adendo) => {
            const item = document.createElement("li")

            const data = document.createElement("time")
            data.dateTime = adendo.criadoEm
            data.textContent = formatarDataHora(adendo.criadoEm)

            const texto = document.createElement("p")
            texto.className = "evolucao__corpo"
            texto.textContent = adendo.texto

            item.append(data, texto)
            lista.appendChild(item)
        })
    }

    return fragmento
}

async function carregarEvolucoes() {
    try {
        const resposta = await api.get(enderecoEvolucoes())
        const evolucoes = resposta.data

        evolucoesPorId = new Map(evolucoes.map((evolucao) => [evolucao._id, evolucao]))
        listaEvolucoes.replaceChildren(...evolucoes.map(montarEvolucao))

        vazioEvolucoes.hidden = evolucoes.length > 0
        contadorEvolucoes.textContent =
            evolucoes.length === 1 ? "1 evolução" : `${evolucoes.length} evoluções`
    } catch (erro) {
        if (erro.response?.status === 401) return
        mostrarToast(mensagemDoErro(erro, "Não foi possível carregar as evoluções."), "erro")
    }
}

// Cliques nos botões das evoluções (um único ouvinte para a lista inteira)
listaEvolucoes.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-acao]")
    if (!botao) return

    const id = botao.closest(".evolucao").dataset.id

    if (botao.dataset.acao === "editar") {
        const evolucao = evolucoesPorId.get(id)
        if (evolucao) abrirEditor(evolucao)
    }

    if (botao.dataset.acao === "adendo") abrirAdendo(id)
})

botaoNovaEvolucao.addEventListener("click", () => abrirEditor())

// ---------------------------------------------------------------------------
// Editor de rascunho
// ---------------------------------------------------------------------------
let evolucaoAtualId = null // null = ainda não foi criada no servidor (cria no primeiro salvamento)
let temporizador = null // espera a pessoa parar de digitar
let alteradoEvolucao = false // true quando há alteração ainda não salva
let fila = Promise.resolve() // salvamentos acontecem um depois do outro, nunca ao mesmo tempo

function abrirEditor(evolucao = null) {
    evolucaoAtualId = evolucao ? evolucao._id : null
    alteradoEvolucao = false

    formEvolucao.reset()
    formEvolucao.elements.dataSessao.value = paraInputDataHora(evolucao ? new Date(evolucao.dataSessao) : new Date())

    if (evolucao) {
        formEvolucao.elements.duracaoMin.value = evolucao.duracaoMin ?? ""
        formEvolucao.elements.modalidade.value = evolucao.modalidade || ""
        formEvolucao.elements.presenca.value = evolucao.presenca || "compareceu"
        formEvolucao.elements.resumo.value = evolucao.resumo || ""
        formEvolucao.elements.observacoes.value = evolucao.observacoes || ""
        formEvolucao.elements.proximosPassos.value = evolucao.proximosPassos || ""
    }

    tituloEditor.textContent = evolucao ? "Editar rascunho" : "Nova evolução"
    statusEvolucao.textContent = evolucao ? "" : "O rascunho é salvo automaticamente."

    areaLista.hidden = true
    formEvolucao.hidden = false
    formEvolucao.elements.resumo.focus()
}

function mostrarLista() {
    formEvolucao.hidden = true
    areaLista.hidden = false
    evolucaoAtualId = null
    alteradoEvolucao = false
    carregarEvolucoes()
}

function dadosDoEditor() {
    const campos = formEvolucao.elements

    const dados = {
        duracaoMin: campos.duracaoMin.value,
        modalidade: campos.modalidade.value,
        presenca: campos.presenca.value,
        resumo: campos.resumo.value,
        observacoes: campos.observacoes.value,
        proximosPassos: campos.proximosPassos.value,
    }

    // O navegador converte a hora local para o formato universal (ISO) antes de enviar,
    // para o servidor não interpretar a hora no fuso errado
    const data = new Date(campos.dataSessao.value)
    if (!Number.isNaN(data.getTime())) dados.dataSessao = data.toISOString()

    return dados
}

async function executarSalvamento() {
    if (!alteradoEvolucao) return // outro salvamento já cobriu tudo o que foi digitado

    alteradoEvolucao = false
    statusEvolucao.textContent = "Salvando..."

    try {
        const dados = dadosDoEditor()

        if (evolucaoAtualId) {
            await api.put(`${enderecoEvolucoes()}/${encodeURIComponent(evolucaoAtualId)}`, dados)
        } else {
            const resposta = await api.post(enderecoEvolucoes(), dados)
            evolucaoAtualId = resposta.data._id // a partir de agora, os salvamentos atualizam este rascunho
        }

        statusEvolucao.textContent = `Salvo às ${horaAgora()}`
    } catch (erro) {
        alteradoEvolucao = true // continua pendente: será tentado de novo
        statusEvolucao.textContent = "Não foi possível salvar. Vamos tentar de novo."
        mostrarToast(mensagemDoErro(erro, "Não foi possível salvar o rascunho."), "erro")
    }
}

// Pede um salvamento. Devolve uma promessa que termina quando ele (e os anteriores) acabarem.
function salvarRascunho() {
    clearTimeout(temporizador)
    temporizador = null
    fila = fila.then(executarSalvamento)
    return fila
}

// Salva sozinho 1,5 segundo depois da última tecla
formEvolucao.addEventListener("input", () => {
    alteradoEvolucao = true
    statusEvolucao.textContent = "Alterações não salvas"

    clearTimeout(temporizador)
    temporizador = setTimeout(salvarRascunho, 1500)
})

// Enter dentro de um campo não pode enviar o formulário
formEvolucao.addEventListener("submit", (evento) => evento.preventDefault())

botaoVoltarLista.addEventListener("click", async () => {
    await salvarRascunho() // grava o que estiver pendente
    if (alteradoEvolucao) return // o salvamento falhou: fica no editor para não perder o texto

    mostrarLista()
})

// Descartar: pede confirmação se o rascunho já existe no servidor
botaoDescartar.addEventListener("click", async () => {
    clearTimeout(temporizador)
    temporizador = null
    await fila // espera algum salvamento em andamento terminar

    if (!evolucaoAtualId) {
        mostrarLista() // nunca foi salvo: nada para apagar
        return
    }

    dialogDescartar.returnValue = "" // sem isso, a escolha da vez anterior ficaria guardada
    dialogDescartar.showModal()
})

dialogDescartar.addEventListener("close", async () => {
    if (dialogDescartar.returnValue !== "descartar") return

    try {
        await api.delete(`${enderecoEvolucoes()}/${encodeURIComponent(evolucaoAtualId)}`)
        mostrarToast("Rascunho descartado.", "sucesso")
        mostrarLista()
    } catch (erro) {
        mostrarToast(mensagemDoErro(erro, "Não foi possível descartar o rascunho."), "erro")
    }
})

// Aviso do navegador se fechar a página com alteração que não conseguiu ser salva
window.addEventListener("beforeunload", (evento) => {
    if (alteradoEvolucao) {
        evento.preventDefault()
        evento.returnValue = ""
    }
})

// Ao trocar de aba do navegador ou minimizar, salva na hora o que estiver pendente
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && alteradoEvolucao) salvarRascunho()
})

// ---------------------------------------------------------------------------
// Finalizar a sessão
// ---------------------------------------------------------------------------
const botaoFinalizar = document.getElementById("botao-finalizar")
const dialogFinalizar = document.getElementById("dialog-finalizar")

botaoFinalizar.addEventListener("click", async () => {
    if (!formEvolucao.elements.resumo.value.trim()) {
        mostrarToast("Escreva o resumo da sessão antes de finalizar.", "erro")
        formEvolucao.elements.resumo.focus()
        return
    }

    // Grava o que estiver pendente (e cria o rascunho, se ainda não existir)
    await salvarRascunho()
    if (alteradoEvolucao || !evolucaoAtualId) return // o salvamento falhou: o aviso já foi mostrado

    dialogFinalizar.returnValue = "" // sem isso, a escolha da vez anterior ficaria guardada
    dialogFinalizar.showModal()
})

dialogFinalizar.addEventListener("close", async () => {
    if (dialogFinalizar.returnValue !== "finalizar") return

    botaoFinalizar.disabled = true

    try {
        // Envia também o texto atual, para o que foi digitado por último não se perder
        await api.post(
            `${enderecoEvolucoes()}/${encodeURIComponent(evolucaoAtualId)}/finalizar`,
            dadosDoEditor()
        )

        alteradoEvolucao = false
        mostrarToast("Sessão finalizada!", "sucesso")
        mostrarLista()
    } catch (erro) {
        mostrarToast(mensagemDoErro(erro, "Não foi possível finalizar a sessão."), "erro")
    } finally {
        botaoFinalizar.disabled = false
    }
})

// ---------------------------------------------------------------------------
// Adendo em evolução finalizada
// ---------------------------------------------------------------------------
const dialogAdendo = document.getElementById("dialog-adendo")
const formAdendo = document.getElementById("form-adendo")
const campoAdendo = document.getElementById("texto-adendo")
const botaoSalvarAdendo = document.getElementById("botao-salvar-adendo")
const botaoCancelarAdendo = document.getElementById("botao-cancelar-adendo")

let evolucaoDoAdendoId = null

function abrirAdendo(idEvolucao) {
    evolucaoDoAdendoId = idEvolucao
    campoAdendo.value = ""
    dialogAdendo.showModal()
    campoAdendo.focus()
}

botaoCancelarAdendo.addEventListener("click", () => dialogAdendo.close())

formAdendo.addEventListener("submit", async (evento) => {
    evento.preventDefault()

    const texto = campoAdendo.value.trim()

    if (!texto) {
        mostrarToast("Escreva o texto do adendo.", "erro")
        campoAdendo.focus()
        return
    }

    botaoSalvarAdendo.disabled = true

    try {
        await api.post(
            `${enderecoEvolucoes()}/${encodeURIComponent(evolucaoDoAdendoId)}/adendos`,
            { texto }
        )

        dialogAdendo.close() // só fecha depois de salvar: se falhar, o texto continua na janela
        mostrarToast("Adendo registrado.", "sucesso")
        carregarEvolucoes()
    } catch (erro) {
        mostrarToast(mensagemDoErro(erro, "Não foi possível registrar o adendo."), "erro")
    } finally {
        botaoSalvarAdendo.disabled = false
    }
})