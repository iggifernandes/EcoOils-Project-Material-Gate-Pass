import re,os
root=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..')
src=open(os.path.join(root,'index.src.html')).read()
logo=open(os.path.join(root,'dev','logo.txt')).read().strip()
qr=open(os.path.join(root,'dev','qrcode.js')).read()
js=open(os.path.join(root,'app.i18n.js')).read()+'\n'+open(os.path.join(root,'app.js')).read()
out=src.replace('%%LOGO%%',logo).replace('/*QRLIB*/',qr.replace('</script>','<\\/script>')).replace('%%APPJS%%',js.replace('</script>','<\\/script>'))
open(os.path.join(root,'index.html'),'w').write(out)
print(len(out))
