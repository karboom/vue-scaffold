#!/bin/bash

oss_key=${ACCESS_KEY}
oss_secret=${ACCESS_SECRET}
oss_host=${TARGET_HOST}
oss_bucket=${TARGET_BUCKET}
oss_dir=${UPLOAD_DIR}
oss_entry_dir=${UPLOAD_ENTRY_DIR}

delimiter="."
# 使用IFS设置分隔符为-
IFS=$delimiter read -ra arr <<< "$oss_host"
# 将第一个片段增加-x后缀
arr[0]="${arr[0]}-internal"
# 将分割后的片段重新拼接回去
oss_host_internal=$(IFS=$delimiter; echo "${arr[*]}")
echo "对应内网域名为 $oss_host_internal"


# 测试内网是否通畅

curl -m 1 "$oss_host_internal"
if [ $? != 0 ]; then
  echo "相对于docker镜像仓库，当前使用外网上传，速度较慢"
else
  echo "启用内网加速"
  oss_host=${oss_host_internal}
fi


if [ ! -f /tmp/ossutil ]; then
    echo "ossutil命令未找到，正在下载并解压..."

    wget https://gosspublic.alicdn.com/ossutil/1.7.13/ossutil64 && mv ossutil64 /tmp/ossutil && chmod u+x /tmp/ossutil

    echo "ossutil 命令下载并解压完成！"
else
    echo "ossutil 命令已存在，无需下载。"
fi


echo "上传 dist 到 oss://${oss_bucket}${oss_dir}"
# 上传所有内容
/tmp/ossutil cp -rf -j 1000 --meta "Cache-Control: public, max-age=31536000" -i ${oss_key} -k ${oss_secret} -e "${oss_host}" ./dist oss://${oss_bucket}${oss_dir}
# 上传失败报错
if [ $? != 0 ]; then
exit 1
fi

# 上传环境占位符
/tmp/ossutil cp -rf --include "*.html" --disable-dir-object --meta "Cache-Control:no-cache" -i ${oss_key} -k ${oss_secret} -e "${oss_host}" ./dist oss://${oss_bucket}${oss_entry_dir}
# 上传失败报错
if [ $? != 0 ]; then
exit 1
fi
