# React 前端基础学习笔记

**日期：** 2026-03-31  
**时长：** 30分钟  
**学习主题：** React 核心概念

---

## 什么是 React？

React 是 Facebook 开发的 UI 库，专注于构建单页应用（SPA）的视图层。

**核心理念：** 用组件化思维构建 UI，用声明式编程替代命令式操作 DOM。

---

## 1. JSX — 模板语法

JSX 是 JavaScript 的语法扩展，看起来像 HTML，但实际上是 JavaScript。

```jsx
const element = <h1 className="title">Hello, React!</h1>;
```

**注意：**
- `class` → `className`（避免与 JS 关键字冲突）
- 标签必须闭合 `<br />`
- 在 JSX 中用 `{}` 嵌入 JS 表达式

```jsx
const name = "大鱼";
const element = <h1>你好，{name}！</h1>;
```

---

## 2. 组件（Component）

组件是 React 的核心building block，可以复用、独立功能。

### 函数组件（推荐方式）

```jsx
function Greeting() {
  return <h1>Hello, World!</h1>;
}
```

### 类组件（旧方式，了解即可）

```jsx
class Greeting extends React.Component {
  render() {
    return <h1>Hello, World!</h1>;
  }
}
```

---

## 3. Props — 组件的属性

Props 是父组件传递给子组件的数据，**单向流动，只读**。

```jsx
// 父组件
function App() {
  return <Greeting name="大鱼" age={25} />;
}

// 子组件
function Greeting(props) {
  return (
    <div>
      <h1>你好，{props.name}！</h1>
      <p>年龄：{props.age}</p>
    </div>
  );
}
```

**解构写法（更简洁）：**

```jsx
function Greeting({ name, age }) {
  return <h1>你好，{name}！年龄：{age}</h1>;
}
```

---

## 4. State — 组件内部状态

State 是组件**自己管理**的数据，会触发视图更新。

### useState Hook

```jsx
import { useState } from 'react';

function Counter() {
  // count 是状态值，setCount 是更新函数
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>增加</button>
    </div>
  );
}
```

### 多个状态

```jsx
const [name, setName] = useState("");
const [isLoggedIn, setIsLoggedIn] = useState(false);
```

### 更新规则

**不要直接修改 state！** 必须用 setCount() 这样的更新函数：

```jsx
// ❌ 错误 — 不会触发重新渲染
count = count + 1;

// ✅ 正确
setCount(count + 1);

// ✅ 正确 — 基于前一个状态更新（函数式更新）
setCount(prev => prev + 1);
```

---

## 5. 事件处理

```jsx
function Button() {
  function handleClick() {
    alert("按钮被点击了！");
  }

  return <button onClick={handleClick}>点我</button>;
}
```

**传参给事件处理函数：**

```jsx
<button onClick={() => handleClick(id)}>删除</button>
```

---

## 6. 条件渲染

```jsx
function UserStatus({ isLoggedIn }) {
  if (isLoggedIn) {
    return <p>已登录</p>;
  }
  return <p>请登录</p>;
}
```

**三元运算符：**

```jsx
return <p>{isLoggedIn ? "欢迎回来" : "请登录"}</p>;
```

---

## 7. 列表渲染 — map()

```jsx
function TodoList() {
  const todos = ["学习 React", "吃饭", "睡觉"];

  return (
    <ul>
      {todos.map((todo, index) => (
        <li key={index}>{todo}</li>
      ))}
    </ul>
  );
}
```

**重要：** 每个列表项需要唯一的 `key` prop（通常用 id）。

---

## 8. React 的工作流程

1. **State/Props 变化** → 触发组件重新渲染
2. **Virtual DOM** → React 生成新的 Virtual DOM 树
3. **Diff 算法** → 对比新旧 Virtual DOM，找出最小变更
4. **真实 DOM 更新** → 只更新变化的部分

---

## 9. 组件生命周期（了解）

现代 React 主要用 Hook 来管理副作用：

```jsx
import { useEffect } from 'react';

useEffect(() => {
  // 组件挂载后执行（类似 componentDidMount）
  console.log("组件已挂载");

  return () => {
    // 组件卸载时执行（类似 componentWillUnmount）
    console.log("组件将卸载");
  };
}, []); // 空数组 = 只执行一次
```

---

## 10. 实践：Todo 应用核心结构

```jsx
import { useState } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState("");

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos([...todos, { id: Date.now(), text: input, done: false }]);
    setInput("");
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  return (
    <div>
      <h1>待办事项</h1>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="输入新待办..."
      />
      <button onClick={addTodo}>添加</button>

      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <span
              style={{ textDecoration: todo.done ? 'line-through' : 'none' }}
              onClick={() => toggleTodo(todo.id)}
            >
              {todo.text}
            </span>
            <button onClick={() => deleteTodo(todo.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TodoApp;
```

---

## 关键概念速记

| 概念 | 说明 |
|------|------|
| JSX | 带 JavaScript 表达式的模板语法 |
| 组件 | 可复用的独立 UI 单元 |
| Props | 父→子 单向数据流，只读 |
| State | 组件内部状态，可变，驱动重渲染 |
| useState | 管理状态的标准 Hook |
| useEffect | 处理副作用（数据获取、订阅等） |
| map() | 列表渲染 |
| key | 列表项唯一标识 |

---

## 下一步学习

- React 进阶：Context、useReducer、自定义 Hooks
- 路由：React Router
- 状态管理：Zustand / Redux
- 样式：CSS Modules / Tailwind
- 与后端通信：Fetch / Axios + Express API

---

🦞 *学习时间：2026-03-31 第1次*
