// Página que monta o prontuário completo para ser salvo em PDF (pelo diálogo de impressão).
// Só entram evoluções FINALIZADAS; o servidor já deixa os rascunhos de fora.

const idPaciente = new URLSearchParams(window.location.search).get("id")

const documento = document.getElementById("documento")
const botaoImprimir = document.getElementById("botao-imprimir")
const linkVoltar = document.getElementById("link-voltar")

// ---------------------------------------------------------------------------
// Apoio
// ---------------------------------------------------------------------------
const rotulos = {
    genero: {
        feminino: "Feminino",
        masculino: "Masculino",
        "nao-binario": "Não binário",
        outro: "Outro",
        "nao-informado": "Prefere não informar",
    },
    estadoCivil: {
        solteiro: "Solteiro(a)",
        casado: "Casado(a) / União estável",
        separado: "Separado(a) / Divorciado(a)",
        viuvo: "Viúvo(a)",
    },
    status: { ativo: "Ativo", pausa: "Em pausa", alta: "Alta", arquivado: "Arquivado" },
    modalidade: { presencial: "Presencial", online: "Online", hibrido: "Híbrido" },
    presenca: { compareceu: "Compareceu", faltou: "Faltou", desmarcou: "Desmarcou" },
}

// Cria um elemento com classe e texto (textContent: o texto nunca vira código)
function criar(tag, classe, texto) {
    const elemento = document.createElement(tag)
    if (classe) elemento.className = classe
    if (texto !== undefined) elemento.textContent = texto
    return elemento
}

const juntar = (...partes) => partes.filter(Boolean).join(", ")

function formatarData(dataIso) {
    if (!dataIso) return ""
    return new Date(dataIso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) // datas de calendário: sem fuso
}

function formatarDataHora(dataIso) {
    if (!dataIso) return ""
    return new Date(dataIso).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })
}

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

function textoPessoa(p = {}) {
    const nome = p.nome && p.parentesco ? `${p.nome} (${p.parentesco})` : p.nome || ""
    return juntar(nome, p.telefone)
}

function textoEndereco(e = {}) {
    const rua = juntar(e.logradouro, e.numero, e.complemento)
    const cidade = [e.cidade, e.uf].filter(Boolean).join("/")
    return juntar(rua, e.bairro, cidade, e.cep ? `CEP ${e.cep}` : "")
}

// Lista de dados (rótulo e valor). Itens sem valor não aparecem no documento.
function listaDeDados(linhas) {
    const lista = criar("dl", "pdf-dados")

    linhas
        .filter(([, valor]) => valor)
        .forEach(([rotulo, valor]) => {
            const grupo = criar("div")
            grupo.append(criar("dt", "", rotulo), criar("dd", "", valor))
            lista.appendChild(grupo)
        })

    return lista
}

function blocoDeTexto(titulo, texto) {
    const bloco = criar("section", "pdf-bloco")
    bloco.append(criar("h4", "", titulo), criar("p", "pdf-texto", texto))
    return bloco
}

// ---------------------------------------------------------------------------
// Montagem do documento
// ---------------------------------------------------------------------------
function montarEvolucao(evolucao, indice) {
    const artigo = criar("article", "pdf-evolucao")

    artigo.appendChild(criar("h3", "", `Sessão ${indice + 1} · ${formatarDataHora(evolucao.dataSessao)}`))

    artigo.appendChild(
        criar(
            "p",
            "pdf-meta",
            [
                evolucao.duracaoMin ? `${evolucao.duracaoMin} min` : "",
                rotulos.modalidade[evolucao.modalidade] || "",
                evolucao.presenca && evolucao.presenca !== "compareceu" ? rotulos.presenca[evolucao.presenca] : "",
                evolucao.finalizadaEm ? `Finalizada em ${formatarDataHora(evolucao.finalizadaEm)}` : "",
            ]
                .filter(Boolean)
                .join(" · ")
        )
    )

    if (evolucao.resumo) artigo.appendChild(blocoDeTexto("Resumo da sessão", evolucao.resumo))
    if (evolucao.observacoes) artigo.appendChild(blocoDeTexto("Observações", evolucao.observacoes))
    if (evolucao.proximosPassos) artigo.appendChild(blocoDeTexto("Próximos passos", evolucao.proximosPassos))

    const adendos = evolucao.adendos || []

    if (adendos.length > 0) {
        const bloco = criar("section", "pdf-adendos")
        const lista = criar("ul")

        bloco.appendChild(criar("h4", "", "Adendos"))

        adendos.forEach((adendo) => {
            const item = criar("li")
            item.append(criar("time", "", formatarDataHora(adendo.criadoEm)), criar("p", "pdf-texto", adendo.texto))
            lista.appendChild(item)
        })

        bloco.appendChild(lista)
        artigo.appendChild(bloco)
    }

    return artigo
}

function montarDocumento(dados) {
    const { psicologo, paciente, prontuario, evolucoes, geradoEm } = dados
    const idade = idadeEmAnos(paciente.dataNascimento)
    const consentimento = paciente.consentimento || {}

    // O navegador usa o título da página como nome sugerido do arquivo PDF
    document.title = `Prontuário - ${paciente.nome} - ${new Date(geradoEm).toISOString().slice(0, 10)}`

    // Cabeçalho
    const cabecalho = criar("header")
    cabecalho.append(
        criar("h1", "", "Prontuário psicológico"),
        criar(
            "p",
            "pdf-sub",
            [psicologo?.nome, psicologo?.crp ? `CRP ${psicologo.crp}` : ""].filter(Boolean).join(" · ")
        )
    )

    // Dados do paciente
    const dadosPaciente = criar("section")
    dadosPaciente.append(
        criar("h2", "", "Dados do paciente"),
        listaDeDados([
            ["Nome", paciente.nome],
            ["Nome social", paciente.nomeSocial],
            [
                "Data de nascimento",
                paciente.dataNascimento
                    ? `${formatarData(paciente.dataNascimento)}${idade !== null ? ` (${idade} anos)` : ""}`
                    : "",
            ],
            ["CPF", paciente.cpf],
            ["Gênero", rotulos.genero[paciente.genero]],
            ["Estado civil", rotulos.estadoCivil[paciente.estadoCivil]],
            ["Escolaridade", paciente.escolaridade],
            ["Profissão", paciente.profissao],
            ["Telefone", paciente.telefone],
            ["E-mail", paciente.email],
            ["Endereço", textoEndereco(paciente.endereco)],
            ["Responsável legal", textoPessoa(paciente.responsavel)],
            ["Contato de emergência", textoPessoa(paciente.emergencia)],
            ["Situação", rotulos.status[paciente.status || "ativo"]],
            ["Início do acompanhamento", formatarData(paciente.dataInicio)],
            ["Queixa principal", paciente.queixa],
            ["Encaminhado por", paciente.encaminhamento],
            ["Medicação em uso", paciente.medicacao],
            ["Tratamentos anteriores", paciente.tratamentosAnteriores],
            ["Histórico familiar", paciente.historicoFamiliar],
            ["Observações do cadastro", paciente.observacoes],
            [
                "Consentimento (LGPD)",
                consentimento.aceito ? `Registrado em ${formatarData(consentimento.data)}` : "",
            ],
        ])
    )

    // Resumo clínico
    const resumo = criar("section")
    resumo.appendChild(criar("h2", "", "Resumo clínico"))

    const blocosResumo = [
        ["Demanda inicial", prontuario?.demandaInicial],
        ["Histórico relevante", prontuario?.historicoRelevante],
        ["Hipótese / formulação", prontuario?.hipoteseFormulacao],
        ["Observações", prontuario?.observacoes],
    ].filter(([, texto]) => texto)

    if (blocosResumo.length === 0) {
        resumo.appendChild(criar("p", "pdf-texto", "Sem registros."))
    } else {
        blocosResumo.forEach(([titulo, texto]) => resumo.appendChild(blocoDeTexto(titulo, texto)))
    }

    // Evoluções (só as finalizadas, da mais antiga para a mais recente)
    const secaoEvolucoes = criar("section")
    secaoEvolucoes.appendChild(criar("h2", "", `Evoluções (${evolucoes.length})`))

    if (evolucoes.length === 0) {
        secaoEvolucoes.appendChild(criar("p", "pdf-texto", "Nenhuma evolução finalizada."))
    } else {
        evolucoes.forEach((evolucao, indice) => secaoEvolucoes.appendChild(montarEvolucao(evolucao, indice)))
    }

    // Rodapé do documento
    const rodape = criar(
        "footer",
        "pdf-rodape",
        `Documento gerado em ${formatarDataHora(geradoEm)}` +
            (psicologo?.nome ? ` por ${psicologo.nome}` : "") +
            ". Evoluções em rascunho não estão incluídas."
    )

    documento.replaceChildren(cabecalho, dadosPaciente, resumo, secaoEvolucoes, rodape)
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------
async function carregarDocumento() {
    if (!idPaciente) {
        toastNaProximaPagina("Escolha um paciente para exportar o prontuário.", "erro")
        window.location.replace("pacientes.html")
        return
    }

    linkVoltar.href = `prontuario.html?id=${encodeURIComponent(idPaciente)}`

    try {
        const resposta = await api.get(`/pacientes/${encodeURIComponent(idPaciente)}/prontuario/completo`)

        montarDocumento(resposta.data)
        botaoImprimir.disabled = false
    } catch (erro) {
        if (erro.response?.status === 401) return // o api.js redireciona para o login

        toastNaProximaPagina(
            erro.response?.status === 404 ? "Paciente não encontrado." : mensagemDoErro(erro),
            "erro"
        )
        window.location.replace("pacientes.html")
    }
}

botaoImprimir.addEventListener("click", () => window.print())

carregarDocumento()