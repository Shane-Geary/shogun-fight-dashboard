import {mockStudents} from './mockData.js'

function renderStudentCards(container, students) {
	console.log('mock data object: ' + JSON.stringify(students))
}

const container = document.querySelector('#students')

renderStudentCards(container, mockStudents)
