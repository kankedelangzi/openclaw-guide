import { useState } from 'react'
import './App.css'

function App() {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [editId, setEditId] = useState(null)
  const [editText, setEditText] = useState('')

  // 添加待办
  const addTodo = () => {
    if (!input.trim()) return
    setTodos([
      ...todos,
      { id: Date.now(), text: input.trim(), done: false, createdAt: new Date().toLocaleString('zh-CN') }
    ])
    setInput('')
  }

  // 切换完成状态
  const toggleTodo = (id) => {
    setTodos(todos.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ))
  }

  // 删除待办
  const deleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  // 开始编辑
  const startEdit = (todo) => {
    setEditId(todo.id)
    setEditText(todo.text)
  }

  // 保存编辑
  const saveEdit = (id) => {
    if (!editText.trim()) return
    setTodos(todos.map(t =>
      t.id === id ? { ...t, text: editText.trim() } : t
    ))
    setEditId(null)
    setEditText('')
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditId(null)
    setEditText('')
  }

  // 按回车添加
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') addTodo()
  }

  const remaining = todos.filter(t => !t.done).length

  return (
    <div className="container">
      <h1>📝 待办事项</h1>
      <p className="subtitle">React + Vite 学习示例</p>

      {/* 输入区域 */}
      <div className="input-row">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入新的待办事项..."
          className="todo-input"
        />
        <button className="btn-add" onClick={addTodo}>添加</button>
      </div>

      {/* 统计 */}
      <div className="stats">
        <span>共 {todos.length} 项</span>
        <span>剩余 {remaining} 项未完成</span>
      </div>

      {/* 列表 */}
      <ul className="todo-list">
        {todos.length === 0 && (
          <li className="empty">还没有待办事项，添加一个吧！🎯</li>
        )}
        {todos.map(todo => (
          <li key={todo.id} className={`todo-item ${todo.done ? 'done' : ''}`}>
            {/* 点击复选框切换状态 */}
            <span className="checkbox" onClick={() => toggleTodo(todo.id)}>
              {todo.done ? '✅' : '⬜'}
            </span>

            {/* 编辑模式 */}
            {editId === todo.id ? (
              <span className="edit-mode">
                <input
                  type="text"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(todo.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  autoFocus
                  className="edit-input"
                />
                <button className="btn-save" onClick={() => saveEdit(todo.id)}>保存</button>
                <button className="btn-cancel" onClick={cancelEdit}>取消</button>
              </span>
            ) : (
              <span className="todo-content" onClick={() => toggleTodo(todo.id)}>
                <span className="todo-text">{todo.text}</span>
                <span className="todo-time">{todo.createdAt}</span>
              </span>
            )}

            {/* 操作按钮 */}
            {editId !== todo.id && (
              <span className="actions">
                <button className="btn-edit" onClick={() => startEdit(todo)}>编辑</button>
                <button className="btn-delete" onClick={() => deleteTodo(todo.id)}>删除</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default App
