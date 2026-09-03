if [ 3 -eq $# ] && [[ ${1} =~ ^[0-9a-z]{1,}$ ]] && [[ ${2} =~ ^s%3A[0-9A-Za-z.%_-]{1,}$ ]] && [ -f "${3}" -a -s "${3}" ]; then
	SERVERID=${1}
	COOKIE_CONNECT_SID=${2}
	FILE="${3}"
	USER_AGENT=C
	if R=$(curl --interface tun1 --http2-prior-knowledge -4s -H Accept: -H User-Agent:\ ${USER_AGENT} -H Cookie:\ connect.sid=${COOKIE_CONNECT_SID} https://wispbyte.com/client/api/server/upload-file?serverId=${SERVERID}) && [[ ${R} =~ ^\{\"object\":\"signed_url\",\"attributes\":\{\"url\":\"(https://[0-9a-z-]{1,}\.wispbyte\.com:443/upload/file\?token=e[0-9A-Za-z._-]{1,})\"\}\}$ ]]; then
		E=.tar.gz && if [ ${E} != "${FILE:${#FILE}-${#E}}" ]; then E=.${FILE##*.}; fi
		if T=${EPOCHREALTIME} && T=Upload.${T:0:10}${T:11}.tmp${E} && R=$(curl --interface tun2 --http3-only -4 --progress-meter -H Accept: -H User-Agent:\ ${USER_AGENT} -F files=@"${FILE}"\;filename=${T} ${BASH_REMATCH[1]} -w A\\n%\{http_code\}\\n%header\{content-length\}\\nB) && [ A$'\n'200$'\n'0$'\n'B == "${R}" ]; then
			echo Uploaded:$'\t'"${FILE}"$'\t'=\>$'\t'${T}
		else
			echo ERROR2:$'\t'${R} >&2
		fi
	else
		echo ERROR1:$'\t'"${R}" >&2
	fi
fi

# cp -ari .git/config ../git_config.${EPOCHSECONDS}
# patch .git/config < git_config.diff.txt
# 7z a -tzip -mx9 ../wispbyte.${EPOCHSECONDS}.zip index.js config.json
# if [[ -d .git ]]; then git reset --hard FETCH_HEAD; git log --no-color -n1; git checkout -f ; git clean -df; if [[ 0 == "1" ]]; then git pull; fi fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; export $(<.env) && /usr/local/bin/node /home/container/index.js
