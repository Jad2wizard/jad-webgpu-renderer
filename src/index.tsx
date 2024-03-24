import * as React from 'react'
import * as ReactDOM from 'react-dom'
import styles from './index.less'
import Demo from './Demo'

/* eslint-disable */
if ((module as any).hot) {
	;(module as any).hot.accept()
}
/* eslint-enable */

const {useCallback} = React

export default function App() {
	const canvasRef = useCallback((dom: HTMLCanvasElement) => {
		if (dom) {
			dom.width = dom.offsetWidth
			dom.height = dom.offsetHeight
			const demo = new Demo({dom})
		}
	}, [])

	return (
		<div className={styles.container}>
			<canvas ref={canvasRef}></canvas>
		</div>
	)
}

// eslint-disable-next-line react/no-deprecated
ReactDOM.render(<App />, document.querySelector('#main'))
