import { useState } from "react";
import { StarParam } from "../../data";
// import { FaEye } from "react-icons/fa";
import { MdArrowForwardIos } from "react-icons/md";

interface CardParam {
  visible: boolean;
  info: StarParam | null;
}

export default function Card({ visible, info }: CardParam) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div
        className={`fixed z-[999999999] sm:block hidden duration-500 top-0 p-8 right-0 ${
          visible && open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="relative">
          <div
            className={`aspect-square custom-card bg-[#ffffff33] bg-blur-custom p-8 text-[#fff]`}
          >
            <h1 className="text-[16px] text-right mb-4 uppercase">
              {info && info.name === "sun" ? "Solar System" : ""}
            </h1>
            <div>
              <div className="text-right">
                Star: <b className="uppercase text-[20px]">{info?.name}</b>
              </div>
              <img
                className="w-[300px] mx-[5vw]"
                src="/images/sun.png"
                alt=""
              />
            </div>

            <div>
              <div>Planets: </div>
              <div className="mt-2">
                {info?.planets.map((planet) => {
                  return (
                    <div
                      key={planet.name}
                      className="py-1 first:border-t border-b border-[#ffffff1e] flex justify-between"
                    >
                      <b className="uppercase text-[20px]">{planet.name}</b>
                      {/* <FaEye /> */}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="card-angle absolute top-0 left-0 w-[7%] bg-blur-custom h-[7%] bg-[#ffffff33]"></div>
        </div>
        {visible && (
          <div
            className={`absolute h-full flex items-center left-0 top-0 -translate-x-full text-[#fff]`}
          >
            <div
              className={`p-2 bg-[#ffffff33] mr-2 duration-150 rounded-full cursor-pointer hover:bg-[#ffffff67] ${
                open ? "rotate-0" : "rotate-180"
              }`}
              onClick={() => {
                setOpen((prev) => !prev);
                console.log("ciao");
              }}
            >
              <MdArrowForwardIos />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
