---
name: vue-scaffold
description: 写代码前必须遵循规范要求
---

# 代码风格
* 变量、函数名采用驼峰命名
* 字符串拼接采用``模板渲染方式
* 禁止写if条件判断属性是否存在，认为对象上的属性一定存在即可
* 错误情况直接抛出
* 函数的关键变量，需要util中的log.info打印日志记录
* 函数必须要有注释，需要有功能说明、设计目的


# 行为习惯
* 根据图片生成页面时需要：vue3 + pinia options表示的state和对应的type(非interface)


# 交互
* store中的IOState对应的数据渲染，都要增加loading状态和空状态展示

# 样式
颜色采用hls描述

# Vue组件
* 使用vue3写法
* 优先使用组件库里面有的组件
* 根据条件渲染文本的情况，先声明一个Map
* html中的事件直接调用store.action
* 变量绑定采用storeToRefs
* api引用的时候不要结构赋值
* util目录下的工具引用的时候不要解构赋值
* 卸载组件的时候要释放store
* 有和渲染相关的变量，写在store.local
* store是工厂方法，写法：xxxStore(id)()
* store引入之后不要解构赋值
* 需要从store计算的属性，直接写在store.getter
* vue生命周期采用组合式写法，要写全，放在script最下方，使用idea注释region标记


# store的使用
* store.ts中的State类型，需要划分为local（本地渲染）和remote（远程数据），这两个类型不要拆分子类型


# 接口
* 所有的api/*.ts 都要有对应的mock，延迟随机0-1s
