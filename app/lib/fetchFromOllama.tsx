'use server'

const host = 'http://localhost:11434'

export async function fetchFromOllama(body: OllamaCompletionRequest): Promise<OllamaCOmpletionResponse> {
	try {
		body.stream = false

		const repsonse = await fetch(`${host}/api/generate`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		return await repsonse.json()
	} catch (e) {
		console.error(e)
		throw new Error('Sorry, there was an error fetching from Ollama')
	}
}

export type OllamaCompletionRequest = {
	model: string
	prompt: string
	images?: string[] // a list of base64-encoded images (for multimodal models such as llava)
	format?: "json"
	options?: any // additional model parameters listed in the documentation for the [Modelfile](https://github.com/jmorganca/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values) such as temperature
	system?: string
	template?: string
	context?: number[]
	stream?: boolean
	raw?: boolean
}

export type OllamaCOmpletionResponse = {
	model: string
	created_at: string
	response: string
	done: boolean
	context: number[]
	total_duration: number
	load_duration: number
	prompt_eval_count: number
	prompt_eval_duration: number
	eval_count: number
	eval_duration: number
}
