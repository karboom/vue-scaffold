/**
 * FileReader 是回调 API，边界处 promise 化才能被 async/await 直接消费；
 * reject 原样透传 reader.error 而非自造 Error——浏览器给的错误文案更准，包装只会丢信息；
 * 只提供 text 场景：ArrayBuffer 分支当前无人用，不预写死路径
 */
export const readFile = (file: File) => {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsText(file)
    })
}
