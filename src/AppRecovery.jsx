import React from 'react';
export default class AppRecovery extends React.Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<main className="app-recovery" role="alert"><h1>Let’s get you back to your flight.</h1><p>This screen couldn’t open. Reload to try again—your saved flights won’t be removed.</p><button onClick={()=>location.reload()}>Reload Envolio</button><a href={import.meta.env.BASE_URL}>Start a new search</a></main>:this.props.children;}
}
