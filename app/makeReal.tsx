import { Editor, TLShapeId, createShapeId } from '@tldraw/tldraw'
import { ResponseShape } from './ResponseShape/ResponseShape'
import { getSelectionAsImageDataUrl } from './lib/getSelectionAsImageDataUrl'

import {
	OllamaCompletionRequest,
	OllamaCOmpletionResponse,
	fetchFromOllama
} from './lib/fetchFromOllama'

const DEBUG = true

// the system prompt explains to gpt-4 what we want it to do and how it should behave.
const systemPrompt = `You are an expert web developer who specializes in building working website prototypes from low-fidelity wireframes.
Your job is to accept low-fidelity wireframes, then create a working prototype using HTML, CSS, and JavaScript, and finally send back the results.
The results should be a single HTML file.
Use tailwind to style the website.
Put any additional CSS styles in a style tag and any JavaScript in a script tag.
Use unpkg or skypack to import any required dependencies.
Use Google fonts to pull in any open source fonts you require.
If you have any images, load them from Unsplash or use solid colored rectangles.

The wireframes may include flow charts, diagrams, labels, arrows, sticky notes, and other features that should inform your work.
If there are screenshots or images, use them to inform the colors, fonts, and layout of your website.
Use your best judgement to determine whether what you see should be part of the user interface, or else is just an annotation.

Use what you know about applications and user experience to fill in any implicit business logic in the wireframes. Flesh it out, make it real!

The user may also provide you with the html of a previous design that they want you to iterate from.
In the wireframe, the previous design's html will appear as a white rectangle.
Use their notes, together with the previous design, to inform your next result.

Sometimes it's hard for you to read the writing in the wireframes.
For this reason, all text from the wireframes will be provided to you as a list of strings, separated by newlines.
Use the provided list of text from the wireframes as a reference if any text is hard to read.

You love your designers and want them to be happy. Incorporating their feedback and notes and producing working websites makes them happy.

When sent new wireframes, respond ONLY with the contents of the html file.`

export async function makeReal(editor: Editor) {
	// we can't make anything real if there's nothing selected
	const selectedShapes = editor.getSelectedShapes()
	if (selectedShapes.length === 0) {
		throw new Error('First select something to make real.')
	}

	// first, we build the prompt that we'll send to openai.
	const prompt = await buildPromptForOllama(editor)

	// then, we create an empty response shape. we'll put the response from openai in here, but for
	// now it'll just show a spinner so the user knows we're working on it.
	const responseShapeId = makeEmptyResponseShape(editor)

	try {
		// make a request to openai. `fetchFromOpenAi` is a next.js server action,
		// so our api key is hidden.
		const req: OllamaCompletionRequest = {
			model: 'llava',
			prompt: prompt,
			// system: systemPrompt,
			images: [await getSelectionAsImageDataUrl(editor)]
		}
		DEBUG && console.debug(req)

		const res = await fetchFromOllama(req)
		DEBUG && console.debug(res)

		// populate the response shape with the html we got back from openai.
		populateResponseShape(editor, responseShapeId, res)
	} catch (e) {
		// if something went wrong, get rid of the unnecessary response shape
		editor.deleteShape(responseShapeId)
		throw e
	}
}

async function buildPromptForOllama(editor: Editor): Promise<string> {
	
	// get all text within the current selection
	const referenceText = getSelectionAsText(editor)
	if (referenceText === '') {
		return 'Generate html based on the wireframes.'
	}
	else {
		return 'Generate html based on the wireframes and the following notes: ' + referenceText
	}
}

function populateResponseShape(
	editor: Editor,
	responseShapeId: TLShapeId,
	ollamaResponse: OllamaCOmpletionResponse
) {
	// extract the html from the response
	const message = ollamaResponse.response
	const start = message.indexOf('<!DOCTYPE html>')
	const end = message.indexOf('</html>')
	if (start == -1 || end == -1) {
		throw new Error('Could not find html in response')
	}
	const html = message.slice(start, end + '</html>'.length)

	// update the response shape we created earlier with the content
	editor.updateShape<ResponseShape>({
		id: responseShapeId,
		type: 'response',
		props: { html },
	})
}

function makeEmptyResponseShape(editor: Editor) {
	const selectionBounds = editor.getSelectionPageBounds()
	if (!selectionBounds) throw new Error('No selection bounds')

	const newShapeId = createShapeId()
	editor.createShape<ResponseShape>({
		id: newShapeId,
		type: 'response',
		x: selectionBounds.maxX + 60,
		y: selectionBounds.y,
	})

	return newShapeId
}

function getContentOfPreviousResponse(editor: Editor) {
	const previousResponses = editor
		.getSelectedShapes()
		.filter((shape): shape is ResponseShape => shape.type === 'response')

	if (previousResponses.length === 0) {
		return null
	}

	if (previousResponses.length > 1) {
		throw new Error('You can only have one previous response selected')
	}

	return previousResponses[0].props.html
}

function getSelectionAsText(editor: Editor) {
	const selectedShapeIds = editor.getSelectedShapeIds()
	const selectedShapeDescendantIds = editor.getShapeAndDescendantIds(selectedShapeIds)

	const texts = Array.from(selectedShapeDescendantIds)
		.map((id) => {
			const shape = editor.getShape(id)
			if (!shape) return null
			if (
				shape.type === 'text' ||
				shape.type === 'geo' ||
				shape.type === 'arrow' ||
				shape.type === 'note'
			) {
				// @ts-expect-error
				return shape.props.text
			}
			return null
		})
		.filter((v) => v !== null && v !== '')

	return texts.join('\n')
}
