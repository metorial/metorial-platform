declare module 'tar-stream' {
  let tar: {
    extract(): any;
    pack(): any;
  };

  export default tar;
}
